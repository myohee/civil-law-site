import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import civilData from "../data/civil_outline_complete.json";
import civilArticles from "../data/civil_articles.json";


/* =========================================================
   타입
========================================================= */

type OutlineNode = {
  title: string;
  children?: OutlineNode[];
  note?: string;
};

type MemoMap = Record<string, string>;

type Article = {
  title: string;
  content: string;
};

type OutlineItemProps = {
  node: OutlineNode;
  level: number;
  index: number;
  path: string;

  openItems: Set<string>;
  editingMemos: Set<string>;
  memos: MemoMap;

  toggleOpen: (path: string) => void;
  toggleMemo: (path: string) => void;
  updateMemo: (path: string, value: string) => void;
};

const articles = civilArticles as Record<string, Article>;


/* =========================================================
   목차 번호
========================================================= */

function getNumber(level: number, index: number) {
  const number = index + 1;

  if (level === 0) {
    return `${number}.`;
  }

  if (level === 1) {
    return `(${number})`;
  }

  if (level === 2) {
    return `${number})`;
  }

  if (level === 3) {
    const circledNumbers = [
      "①",
      "②",
      "③",
      "④",
      "⑤",
      "⑥",
      "⑦",
      "⑧",
      "⑨",
      "⑩",
      "⑪",
      "⑫",
      "⑬",
      "⑭",
      "⑮",
      "⑯",
      "⑰",
      "⑱",
      "⑲",
      "⑳",
    ];

    return circledNumbers[index] ?? `${number}`;
  }

  return "";
}


/* =========================================================
   메모 표시
   @245 → 민법 제245조 표시
   @245의2 → 가지조문도 가능
========================================================= */

function MemoDisplay({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="memo-display">
      {lines.map((line, index) => {
        const match = line
          .trim()
          .match(/^@(\d+(?:의\d+)?)$/);

        if (match) {
          const articleNumber = match[1];
          const article = articles[articleNumber];

          if (!article) {
            return (
              <div key={index} className="memo-line">
                {line}
              </div>
            );
          }

          return (
            <div className="article-box" key={index}>
              <div className="article-title">
                제{articleNumber}조
                {article.title ? ` (${article.title})` : ""}
              </div>

              <div className="article-content">
                {article.content}
              </div>
            </div>
          );
        }

        return (
          <div key={index} className="memo-line">
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}


/* =========================================================
   MemoEditor
========================================================= */

type MemoEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

function MemoEditor({
  value,
  onChange,
}: MemoEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const INDENT = "    ";


  /* =======================================================
     textarea 높이 조절

     중요:
     height를 매번 auto로 바꾸지 않음.
     실제로 높이가 부족할 때만 늘림.
  ======================================================= */

  const growTextarea = (
    textarea: HTMLTextAreaElement
  ) => {
    const currentHeight =
      textarea.getBoundingClientRect().height;

    const requiredHeight =
      textarea.scrollHeight;

    if (requiredHeight > currentHeight + 1) {
      textarea.style.height =
        `${requiredHeight}px`;
    }
  };


  /*
    처음 메모를 열었을 때만
    저장된 내용에 맞춰 높이를 계산
  */

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const requiredHeight =
      Math.max(
        textarea.scrollHeight,
        44
      );

    textarea.style.height =
      `${requiredHeight}px`;
  }, []);


  /* =======================================================
     커서 이동
  ======================================================= */

  const moveCursor = (
    textarea: HTMLTextAreaElement,
    position: number
  ) => {
    requestAnimationFrame(() => {
      textarea.selectionStart = position;
      textarea.selectionEnd = position;

      growTextarea(textarea);
    });
  };


  /* =======================================================
     현재 줄 정보
  ======================================================= */

  const getCurrentLine = (
    textarea: HTMLTextAreaElement
  ) => {
    const currentValue = textarea.value;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const beforeCursor =
      currentValue.slice(0, start);

    const lineStart =
      beforeCursor.lastIndexOf("\n") + 1;

    const nextLineBreak =
      currentValue.indexOf("\n", start);

    const lineEnd =
      nextLineBreak === -1
        ? currentValue.length
        : nextLineBreak;

    const line =
      currentValue.slice(
        lineStart,
        lineEnd
      );

    return {
      currentValue,
      start,
      end,
      lineStart,
      lineEnd,
      line,
    };
  };


  /* =========================================================
     목록 형식 분석
  ========================================================= */

  const parseLine = (line: string) => {
    const level1 =
      line.match(/^(\s*)(\d+)\.\s?(.*)$/);

    if (level1) {
      return {
        type: "level1" as const,
        indent: level1[1],
        number: Number(level1[2]),
        content: level1[3],
      };
    }


    const level2 =
      line.match(/^(\s*)\((\d+)\)\s?(.*)$/);

    if (level2) {
      return {
        type: "level2" as const,
        indent: level2[1],
        number: Number(level2[2]),
        content: level2[3],
      };
    }


    const level3 =
      line.match(/^(\s*)(\d+)\)\s?(.*)$/);

    if (level3) {
      return {
        type: "level3" as const,
        indent: level3[1],
        number: Number(level3[2]),
        content: level3[3],
      };
    }


    const bullet =
      line.match(/^(\s*)-\s?(.*)$/);

    if (bullet) {
      return {
        type: "bullet" as const,
        indent: bullet[1],
        number: null,
        content: bullet[2],
      };
    }

    return null;
  };


  /* =========================================================
     Enter
  ========================================================= */

  const handleEnter = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea = event.currentTarget;

    if (
      isComposingRef.current ||
      event.nativeEvent.isComposing
    ) {
      return;
    }


    const {
      currentValue,
      start,
      end,
      lineStart,
      line,
    } = getCurrentLine(textarea);


    const parsed = parseLine(line);

    /*
      목록 형식이 아니면
      Safari 기본 Enter 사용
    */

    if (!parsed) {
      return;
    }

    event.preventDefault();


    /* =====================================================
       빈 목록에서 Enter → 목록 종료
    ===================================================== */

    if (parsed.content.trim() === "") {
      const beforeLine =
        currentValue.slice(
          0,
          lineStart
        );

      const afterCursor =
        currentValue.slice(end);

      const newValue =
        beforeLine +
        parsed.indent +
        afterCursor;

      onChange(newValue);

      moveCursor(
        textarea,
        beforeLine.length +
          parsed.indent.length
      );

      return;
    }


    /* =====================================================
       다음 번호
    ===================================================== */

    let nextPrefix = "";

    if (parsed.type === "level1") {
      nextPrefix =
        `${parsed.indent}${parsed.number! + 1}. `;
    }

    if (parsed.type === "level2") {
      nextPrefix =
        `${parsed.indent}(${parsed.number! + 1}) `;
    }

    if (parsed.type === "level3") {
      nextPrefix =
        `${parsed.indent}${parsed.number! + 1}) `;
    }

    if (parsed.type === "bullet") {
      nextPrefix =
        `${parsed.indent}- `;
    }


    const insertion =
      `\n${nextPrefix}`;

    const newValue =
      currentValue.slice(0, start) +
      insertion +
      currentValue.slice(end);

    onChange(newValue);

    moveCursor(
      textarea,
      start + insertion.length
    );
  };


  /* =========================================================
     Tab
  ========================================================= */

  const handleTab = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea = event.currentTarget;

    if (
      isComposingRef.current ||
      event.nativeEvent.isComposing
    ) {
      return;
    }


    const {
      currentValue,
      lineStart,
      lineEnd,
      line,
    } = getCurrentLine(textarea);

    const parsed = parseLine(line);

    event.preventDefault();


    /* =====================================================
       일반 문장
    ===================================================== */

    if (!parsed) {
      const start =
        textarea.selectionStart;

      const end =
        textarea.selectionEnd;


      if (event.shiftKey) {
        const currentLine =
          currentValue.slice(
            lineStart,
            lineEnd
          );

        const spaces =
          currentLine.match(/^ +/)?.[0].length ?? 0;

        const removeCount =
          Math.min(
            spaces,
            INDENT.length
          );

        if (removeCount === 0) {
          return;
        }

        const newLine =
          currentLine.slice(
            removeCount
          );

        const newValue =
          currentValue.slice(
            0,
            lineStart
          ) +
          newLine +
          currentValue.slice(
            lineEnd
          );

        onChange(newValue);

        moveCursor(
          textarea,
          Math.max(
            lineStart,
            start - removeCount
          )
        );

        return;
      }


      const newValue =
        currentValue.slice(0, start) +
        INDENT +
        currentValue.slice(end);

      onChange(newValue);

      moveCursor(
        textarea,
        start + INDENT.length
      );

      return;
    }


    /* =====================================================
       - 목록
    ===================================================== */

    if (parsed.type === "bullet") {
      let newIndent =
        parsed.indent;

      if (event.shiftKey) {
        if (newIndent.length === 0) {
          return;
        }

        newIndent =
          newIndent.slice(
            0,
            Math.max(
              0,
              newIndent.length -
                INDENT.length
            )
          );
      } else {
        newIndent += INDENT;
      }


      const newLine =
        `${newIndent}- ${parsed.content}`;

      const newValue =
        currentValue.slice(
          0,
          lineStart
        ) +
        newLine +
        currentValue.slice(
          lineEnd
        );

      const oldPosition =
        textarea.selectionStart;

      onChange(newValue);

      const difference =
        newLine.length -
        line.length;

      moveCursor(
        textarea,
        Math.max(
          lineStart,
          oldPosition +
            difference
        )
      );

      return;
    }


    /* =====================================================
       번호 목록
    ===================================================== */

    let newLine = "";


    /*
      Tab
      1. → (1) → 1)
    */

    if (!event.shiftKey) {
      if (parsed.type === "level1") {
        newLine =
          `${parsed.indent}${INDENT}` +
          `(1) ${parsed.content}`;
      }

      else if (parsed.type === "level2") {
        newLine =
          `${parsed.indent}${INDENT}` +
          `1) ${parsed.content}`;
      }

      else if (parsed.type === "level3") {
        newLine =
          `${parsed.indent}${INDENT}` +
          `${parsed.number}) ${parsed.content}`;
      }
    }


    /*
      Shift + Tab
      1) → (1) → 1.
    */

    else {
      if (parsed.type === "level3") {
        const newIndent =
          parsed.indent.length >=
          INDENT.length
            ? parsed.indent.slice(
                0,
                -INDENT.length
              )
            : "";

        newLine =
          `${newIndent}(1) ${parsed.content}`;
      }

      else if (parsed.type === "level2") {
        const newIndent =
          parsed.indent.length >=
          INDENT.length
            ? parsed.indent.slice(
                0,
                -INDENT.length
              )
            : "";

        newLine =
          `${newIndent}1. ${parsed.content}`;
      }

      else if (parsed.type === "level1") {
        if (
          parsed.indent.length === 0
        ) {
          return;
        }

        const newIndent =
          parsed.indent.length >=
          INDENT.length
            ? parsed.indent.slice(
                0,
                -INDENT.length
              )
            : "";

        newLine =
          `${newIndent}${parsed.number}. ${parsed.content}`;
      }
    }


    if (!newLine) {
      return;
    }


    const oldCursorPosition =
      textarea.selectionStart;

    const cursorOffset =
      oldCursorPosition -
      lineStart;

    const newValue =
      currentValue.slice(
        0,
        lineStart
      ) +
      newLine +
      currentValue.slice(
        lineEnd
      );

    onChange(newValue);


    const lengthDifference =
      newLine.length -
      line.length;

    const newCursorPosition =
      lineStart +
      Math.max(
        0,
        cursorOffset +
          lengthDifference
      );

    moveCursor(
      textarea,
      newCursorPosition
    );
  };


  /* =========================================================
     키보드
  ========================================================= */

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      isComposingRef.current ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    if (event.key === "Tab") {
      handleTab(event);
      return;
    }

    if (event.key === "Enter") {
      handleEnter(event);
    }
  };


  /* =========================================================
     textarea
  ========================================================= */

  return (
    <textarea
      ref={textareaRef}
      className="memo-editor"

      value={value}

      rows={1}

      placeholder="내용을 입력하세요...  조문은 @245처럼 입력"

      onCompositionStart={() => {
        isComposingRef.current = true;
      }}

      onCompositionEnd={(event) => {
        isComposingRef.current = false;

        onChange(
          event.currentTarget.value
        );
      }}

      onKeyDown={handleKeyDown}

      onChange={(event) => {
        /*
          먼저 현재 DOM textarea를 확보합니다.
        */

        const textarea =
          event.currentTarget;

        /*
          메모 저장
        */

        onChange(textarea.value);

        /*
          기존처럼 매번
          height = auto
          를 하지 않습니다.

          실제 내용이 textarea보다
          길어진 경우에만 높이를 늘립니다.
        */

        growTextarea(textarea);
      }}
    />
  );
}


/* =========================================================
   목차 하나
========================================================= */

function OutlineItem({
  node,
  level,
  index,
  path,

  openItems,
  editingMemos,
  memos,

  toggleOpen,
  toggleMemo,
  updateMemo,
}: OutlineItemProps) {
  const hasChildren =
    Boolean(
      node.children &&
      node.children.length > 0
    );

  const memo =
    memos[path] ?? "";

  const hasMemo =
    memo.trim().length > 0;

  const hasExpandableContent =
    hasChildren ||
    hasMemo ||
    Boolean(node.note);

  const isOpen =
    openItems.has(path);

  const isEditingMemo =
    editingMemos.has(path);


  return (
    <div
      className={`outline-level outline-level-${level}`}
    >
      <div className="outline-row">
        <span className="outline-number">
          {getNumber(level, index)}
        </span>


        <button
          type="button"
          className="outline-title-button"
          onClick={() =>
            toggleMemo(path)
          }
        >
          {node.title}
        </button>


        <div className="outline-action">
          {hasExpandableContent && (
            <button
              type="button"
              className={
                `outline-toggle ${
                  isOpen ? "open" : ""
                }`
              }
              onClick={() =>
                toggleOpen(path)
              }
              aria-label={
                isOpen
                  ? "접기"
                  : "펼치기"
              }
            >
              ›
            </button>
          )}
        </div>
      </div>


      {/* 메모 편집 */}

      {isEditingMemo && (
        <div className="outline-memo">
          <MemoEditor
            value={memo}
            onChange={(value) =>
              updateMemo(
                path,
                value
              )
            }
          />
        </div>
      )}


      {/* 펼친 내용 */}

      {isOpen && (
        <div className="outline-expanded-content">

          {hasMemo &&
            !isEditingMemo && (
              <div className="outline-memo">
                <MemoDisplay
                  text={memo}
                />
              </div>
            )}


          {node.note && (
            <div className="outline-note">
              {node.note}
            </div>
          )}


          {hasChildren && (
            <div className="outline-children">
              {node.children!.map(
                (
                  child,
                  childIndex
                ) => {
                  const childPath =
                    `${path}-${childIndex}`;

                  return (
                    <OutlineItem
                      key={childPath}
                      node={child}
                      level={level + 1}
                      index={childIndex}
                      path={childPath}

                      openItems={
                        openItems
                      }

                      editingMemos={
                        editingMemos
                      }

                      memos={memos}

                      toggleOpen={
                        toggleOpen
                      }

                      toggleMemo={
                        toggleMemo
                      }

                      updateMemo={
                        updateMemo
                      }
                    />
                  );
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* =========================================================
   TopicPage
========================================================= */

function TopicPage() {
  const navigate =
    useNavigate();

  const {
    partIndex,
    topicIndex,
  } = useParams();


  const partNumber =
    Number(partIndex);

  const topicNumber =
    Number(topicIndex);


  const part =
    civilData.parts[partNumber];

  const topic =
    part?.topics[topicNumber];


  const storageKey =
    `civil-memos-${partNumber}-${topicNumber}`;


  const [
    openItems,
    setOpenItems,
  ] = useState<Set<string>>(
    new Set()
  );


  const [
    editingMemos,
    setEditingMemos,
  ] = useState<Set<string>>(
    new Set()
  );


  const [
    memos,
    setMemos,
  ] = useState<MemoMap>({});


  /* =========================================================
     저장된 메모 불러오기
  ========================================================= */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        storageKey
      );

    if (!saved) {
      setMemos({});
      return;
    }

    try {
      setMemos(
        JSON.parse(saved)
      );
    } catch {
      setMemos({});
    }
  }, [storageKey]);


  /* =========================================================
     메모 저장
  ========================================================= */

  const updateMemo = (
    path: string,
    text: string
  ) => {
    setMemos((previous) => {
      const next = {
        ...previous,
      };

      if (
        text.trim().length === 0
      ) {
        delete next[path];
      } else {
        next[path] = text;
      }

      localStorage.setItem(
        storageKey,
        JSON.stringify(next)
      );

      return next;
    });
  };


  /* =========================================================
     펼치기
  ========================================================= */

  const toggleOpen = (
    path: string
  ) => {
    setOpenItems((previous) => {
      const next =
        new Set(previous);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };


  /* =========================================================
     메모 편집

     이전의 scrollY 저장 / scrollTo 코드는 삭제.
     브라우저 스크롤을 강제로 조작하지 않음.
  ========================================================= */

  const toggleMemo = (
    path: string
  ) => {
    setEditingMemos((previous) => {
      const next =
        new Set(previous);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };


  /* =========================================================
     전체 펼치기
  ========================================================= */

  const collectExpandablePaths = (
    nodes: OutlineNode[],
    parentPath = ""
  ) => {
    const paths: string[] = [];

    nodes.forEach(
      (node, index) => {
        const path =
          parentPath
            ? `${parentPath}-${index}`
            : `${index}`;

        const hasChildren =
          Boolean(
            node.children &&
            node.children.length > 0
          );

        const hasMemo =
          Boolean(
            memos[path]?.trim()
          );

        const hasNote =
          Boolean(node.note);

        if (
          hasChildren ||
          hasMemo ||
          hasNote
        ) {
          paths.push(path);
        }

        if (
          node.children &&
          node.children.length > 0
        ) {
          paths.push(
            ...collectExpandablePaths(
              node.children,
              path
            )
          );
        }
      }
    );

    return paths;
  };


  const openAll = () => {
    if (!topic) return;

    const paths =
      collectExpandablePaths(
        topic.children ?? []
      );

    setOpenItems(
      new Set(paths)
    );

    setEditingMemos(
      new Set()
    );
  };


  const closeAll = () => {
    setOpenItems(
      new Set()
    );

    setEditingMemos(
      new Set()
    );
  };


  /* =========================================================
     잘못된 주소
  ========================================================= */

  if (!part || !topic) {
    return (
      <main className="app">
        <p>
          해당 목차를 찾을 수 없습니다.
        </p>

        <button
          className="back-button"
          onClick={() =>
            navigate("/")
          }
        >
          홈으로
        </button>
      </main>
    );
  }


  /* =========================================================
     화면
  ========================================================= */

  return (
    <main className="app topic-page">

      <button
        className="back-button"
        onClick={() =>
          navigate(
            `/part/${partNumber}`
          )
        }
      >
        ← {part.title}
      </button>


      <header className="topic-header">
        <span className="part-label">
          PART {partNumber + 1}
        </span>

        <h1>
          {topic.title}
        </h1>
      </header>


      <div className="outline-controls">
        <button
          type="button"
          onClick={openAll}
        >
          전체 열기
        </button>

        <button
          type="button"
          onClick={closeAll}
        >
          전체 닫기
        </button>
      </div>


      <section className="outline-container">
        {topic.children &&
        topic.children.length > 0 ? (
          topic.children.map(
            (node, index) => {
              const path =
                `${index}`;

              return (
                <OutlineItem
                  key={path}

                  node={node}

                  level={0}

                  index={index}

                  path={path}

                  openItems={
                    openItems
                  }

                  editingMemos={
                    editingMemos
                  }

                  memos={memos}

                  toggleOpen={
                    toggleOpen
                  }

                  toggleMemo={
                    toggleMemo
                  }

                  updateMemo={
                    updateMemo
                  }
                />
              );
            }
          )
        ) : (
          <div className="empty-outline">
            등록된 목차가 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}


export default TopicPage;