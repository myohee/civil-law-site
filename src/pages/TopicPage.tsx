import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

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

  updateMemo: (
    path: string,
    value: string
  ) => void;
};


/* =========================================================
   목차 번호

   1.
   (1)
   1)
   ①
========================================================= */

function getNumber(
  level: number,
  index: number
) {
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

    return (
      circledNumbers[index] ??
      `${number}`
    );
  }

  return "";
}


/* =========================================================
   조문 데이터 타입
========================================================= */

type Article = {
  title: string;
  content: string;
};

const articles =
  civilArticles as Record<
    string,
    Article
  >;


/* =========================================================
   메모 표시

   @245
   @750
   @1000
   @245의2

   → 실제 조문으로 변환
========================================================= */

function MemoDisplay({
  text,
}: {
  text: string;
}) {
  /*
    줄 전체가

    @245

    처럼 되어 있을 때만
    조문으로 변환합니다.

    따라서 일반 문장 안의
    @숫자는 건드리지 않습니다.
  */

  const lines = text.split("\n");

  return (
    <div className="memo-display">
      {lines.map((line, index) => {
        const match =
          line
            .trim()
            .match(
              /^@(\d+(?:의\d+)?)$/
            );

        if (match) {
          const articleNumber =
            match[1];

          const article =
            articles[articleNumber];

          /*
            존재하지 않는 조문이면
            사용자가 입력한 내용을
            그대로 보여줍니다.
          */

          if (!article) {
            return (
              <div
                key={index}
                className="memo-line"
              >
                {line}
              </div>
            );
          }

          return (
            <div
              className="article-box"
              key={index}
            >
              <div className="article-title">
                제{articleNumber}조
                {article.title
                  ? ` (${article.title})`
                  : ""}
              </div>

              <div className="article-content">
                {article.content}
              </div>
            </div>
          );
        }

        /*
          일반 메모 줄
        */

        return (
          <div
            key={index}
            className="memo-line"
          >
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}


/* =========================================================
   MemoEditor

   iPad 한글 IME 대응 포함
========================================================= */

type MemoEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

function MemoEditor({
  value,
  onChange,
}: MemoEditorProps) {
  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const isComposingRef =
    useRef(false);

  const INDENT = "    ";


  /* =======================================================
     textarea 높이 자동 조절
  ======================================================= */

  const resizeTextarea = () => {
    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height =
      `${Math.max(
        textarea.scrollHeight,
        44
      )}px`;
  };


  useEffect(() => {
  resizeTextarea();
}, []);


  useEffect(() => {
    resizeTextarea();
  }, [value]);


  /* =======================================================
     커서 이동
  ======================================================= */

  const moveCursor = (
    textarea: HTMLTextAreaElement,
    position: number
  ) => {
    requestAnimationFrame(() => {
      textarea.selectionStart =
        position;

      textarea.selectionEnd =
        position;

      resizeTextarea();
    });
  };


  /* =======================================================
     현재 줄
  ======================================================= */

  const getCurrentLine = (
    textarea: HTMLTextAreaElement
  ) => {
    /*
      iPad 한글 입력 문제를 피하기 위해
      React state의 value 대신
      실제 textarea.value를 기준으로 처리
    */

    const currentValue =
      textarea.value;

    const start =
      textarea.selectionStart;

    const end =
      textarea.selectionEnd;

    const beforeCursor =
      currentValue.slice(0, start);

    const lineStart =
      beforeCursor.lastIndexOf("\n") + 1;

    const nextLineBreak =
      currentValue.indexOf(
        "\n",
        start
      );

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


  /* =======================================================
     목록 형식 분석
  ======================================================= */

  const parseLine = (
    line: string
  ) => {
    /*
      1. 내용
    */

    const level1 =
      line.match(
        /^(\s*)(\d+)\.\s?(.*)$/
      );

    if (level1) {
      return {
        type: "level1" as const,
        indent: level1[1],
        number:
          Number(level1[2]),
        content:
          level1[3],
      };
    }


    /*
      (1) 내용
    */

    const level2 =
      line.match(
        /^(\s*)\((\d+)\)\s?(.*)$/
      );

    if (level2) {
      return {
        type: "level2" as const,
        indent: level2[1],
        number:
          Number(level2[2]),
        content:
          level2[3],
      };
    }


    /*
      1) 내용
    */

    const level3 =
      line.match(
        /^(\s*)(\d+)\)\s?(.*)$/
      );

    if (level3) {
      return {
        type: "level3" as const,
        indent: level3[1],
        number:
          Number(level3[2]),
        content:
          level3[3],
      };
    }


    /*
      - 내용
    */

    const bullet =
      line.match(
        /^(\s*)-\s?(.*)$/
      );

    if (bullet) {
      return {
        type: "bullet" as const,
        indent: bullet[1],
        number: null,
        content:
          bullet[2],
      };
    }

    return null;
  };


  /* =======================================================
     Enter
  ======================================================= */

  const handleEnter = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea =
      event.currentTarget;


    /*
      한글 조합 중에는
      Enter 자동처리를 하지 않음
    */

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
    } =
      getCurrentLine(textarea);


    const parsed =
      parseLine(line);


    /*
      일반 문장이면
      브라우저 기본 Enter
    */

    if (!parsed) {
      return;
    }


    event.preventDefault();


    /* =====================================================
       빈 목록에서 Enter → 목록 종료
    ===================================================== */

    if (
      parsed.content.trim() === ""
    ) {
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


    if (
      parsed.type === "level1"
    ) {
      nextPrefix =
        `${parsed.indent}${parsed.number! + 1
        }. `;
    }


    if (
      parsed.type === "level2"
    ) {
      nextPrefix =
        `${parsed.indent}(${parsed.number! + 1
        }) `;
    }


    if (
      parsed.type === "level3"
    ) {
      nextPrefix =
        `${parsed.indent}${parsed.number! + 1
        }) `;
    }


    if (
      parsed.type === "bullet"
    ) {
      nextPrefix =
        `${parsed.indent}- `;
    }


    const insertion =
      `\n${nextPrefix}`;


    const newValue =
      currentValue.slice(
        0,
        start
      ) +
      insertion +
      currentValue.slice(end);


    onChange(newValue);


    moveCursor(
      textarea,
      start +
      insertion.length
    );
  };


  /* =======================================================
     Tab
  ======================================================= */

  const handleTab = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea =
      event.currentTarget;


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
    } =
      getCurrentLine(textarea);


    const parsed =
      parseLine(line);


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
          currentLine.match(
            /^ +/
          )?.[0].length ?? 0;


        const removeCount =
          Math.min(
            spaces,
            INDENT.length
          );


        if (
          removeCount === 0
        ) {
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
            start -
            removeCount
          )
        );

        return;
      }


      const newValue =
        currentValue.slice(
          0,
          start
        ) +
        INDENT +
        currentValue.slice(end);


      onChange(newValue);


      moveCursor(
        textarea,
        start +
        INDENT.length
      );

      return;
    }


    /* =====================================================
       - 목록
    ===================================================== */

    if (
      parsed.type === "bullet"
    ) {
      let newIndent =
        parsed.indent;


      if (event.shiftKey) {
        if (
          newIndent.length === 0
        ) {
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
        `${newIndent}- ${parsed.content
        }`;


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


    if (!event.shiftKey) {
      /*
        Tab

        1. → (1) → 1)
      */

      if (
        parsed.type === "level1"
      ) {
        newLine =
          `${parsed.indent}${INDENT}` +
          `(1) ${parsed.content}`;
      }

      else if (
        parsed.type === "level2"
      ) {
        newLine =
          `${parsed.indent}${INDENT}` +
          `1) ${parsed.content}`;
      }

      else if (
        parsed.type === "level3"
      ) {
        newLine =
          `${parsed.indent}${INDENT}` +
          `${parsed.number}) ` +
          parsed.content;
      }
    }

    else {
      /*
        Shift + Tab

        1) → (1) → 1.
      */

      if (
        parsed.type === "level3"
      ) {
        const newIndent =
          parsed.indent.length >=
            INDENT.length
            ? parsed.indent.slice(
              0,
              -INDENT.length
            )
            : "";

        newLine =
          `${newIndent}(1) ` +
          parsed.content;
      }

      else if (
        parsed.type === "level2"
      ) {
        const newIndent =
          parsed.indent.length >=
            INDENT.length
            ? parsed.indent.slice(
              0,
              -INDENT.length
            )
            : "";

        newLine =
          `${newIndent}1. ` +
          parsed.content;
      }

      else if (
        parsed.type === "level1"
      ) {
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
          `${newIndent}${parsed.number
          }. ${parsed.content}`;
      }
    }


    if (!newLine) return;


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


  /* =======================================================
     키 입력
  ======================================================= */

  const handleKeyDown = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
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


  /* =======================================================
     textarea
  ======================================================= */

  return (
    <textarea
      ref={textareaRef}

      className="memo-editor"

      value={value}

      rows={1}

      placeholder={
        "내용을 입력하세요...  조문은 @245처럼 입력"
      }

      onCompositionStart={() => {
        isComposingRef.current =
          true;
      }}

      onCompositionEnd={(
        event
      ) => {
        isComposingRef.current =
          false;

        onChange(
          event.currentTarget.value
        );

        requestAnimationFrame(
          resizeTextarea
        );
      }}

      onKeyDown={
        handleKeyDown
      }

      onChange={(event) => {
        onChange(
          event.currentTarget.value
        );

        requestAnimationFrame(
          resizeTextarea
        );
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
      {/* =====================
          목차 한 줄
      ===================== */}

      <div className="outline-row">
        <span className="outline-number">
          {getNumber(
            level,
            index
          )}
        </span>


        {/* 제목 클릭 → 메모 */}

        <button
          type="button"
          className="outline-title-button"
          onClick={() =>
            toggleMemo(path)
          }
        >
          {node.title}
        </button>


        {/* > 클릭 → 하위내용 */}

        <div className="outline-action">
          {hasExpandableContent && (
            <button
              type="button"
              className={
                `outline-toggle ${isOpen
                  ? "open"
                  : ""
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


      {/* =====================
          메모 편집
      ===================== */}

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


      {/* =====================
          펼친 내용
      ===================== */}

      {isOpen && (
        <div className="outline-expanded-content">

          {/* 저장된 메모 */}

          {hasMemo &&
            !isEditingMemo && (
              <div className="outline-memo">
                <MemoDisplay
                  text={memo}
                />
              </div>
            )}


          {/* JSON 기본 note */}

          {node.note && (
            <div className="outline-note">
              {node.note}
            </div>
          )}


          {/* 하위 목차 */}

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
                      key={
                        childPath
                      }
                      node={child}
                      level={
                        level + 1
                      }
                      index={
                        childIndex
                      }
                      path={
                        childPath
                      }

                      openItems={
                        openItems
                      }

                      editingMemos={
                        editingMemos
                      }

                      memos={
                        memos
                      }

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
    civilData.parts[
    partNumber
    ];


  const topic =
    part?.topics[
    topicNumber
    ];


  /* =======================================================
     localStorage key
  ======================================================= */

  const storageKey =
    `civil-memos-${partNumber}-${topicNumber}`;


  /* =======================================================
     State
  ======================================================= */

  const [
    openItems,
    setOpenItems,
  ] =
    useState<Set<string>>(
      new Set()
    );


  const [
    editingMemos,
    setEditingMemos,
  ] =
    useState<Set<string>>(
      new Set()
    );


  const [
    memos,
    setMemos,
  ] =
    useState<MemoMap>(
      {}
    );


  /* =======================================================
     메모 불러오기
  ======================================================= */

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


  /* =======================================================
     메모 저장
  ======================================================= */

  const updateMemo = (
    path: string,
    text: string
  ) => {
    setMemos(
      (previous) => {
        const next = {
          ...previous,
        };


        if (
          text.trim().length === 0
        ) {
          delete next[path];
        } else {
          next[path] =
            text;
        }


        localStorage.setItem(
          storageKey,
          JSON.stringify(next)
        );


        return next;
      }
    );
  };


  /* =======================================================
     > 토글
  ======================================================= */

  const toggleOpen = (
    path: string
  ) => {
    setOpenItems(
      (previous) => {
        const next =
          new Set(previous);


        if (
          next.has(path)
        ) {
          next.delete(path);
        } else {
          next.add(path);
        }


        return next;
      }
    );
  };


  /* =======================================================
     제목 클릭 → 메모 편집
  ======================================================= */

  const toggleMemo = (
  path: string
) => {
  const scrollY = window.scrollY;

  setEditingMemos(
    (previous) => {
      const next =
        new Set(previous);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    }
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollY,
        behavior: "instant",
      });
    });
  });
};


  /* =======================================================
     전체 펼치기용 path 수집
  ======================================================= */

  const collectExpandablePaths = (
    nodes: OutlineNode[],
    parentPath = ""
  ) => {
    const paths: string[] =
      [];


    nodes.forEach(
      (node, index) => {
        const path =
          parentPath
            ? `${parentPath}-${index}`
            : `${index}`;


        const hasChildren =
          Boolean(
            node.children &&
            node.children.length >
            0
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
          node.children.length >
          0
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


  /* =======================================================
     전체 펼치기
  ======================================================= */

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


  /* =======================================================
     전체 닫기
  ======================================================= */

  const closeAll = () => {
    setOpenItems(
      new Set()
    );

    setEditingMemos(
      new Set()
    );
  };


  /* =======================================================
     잘못된 주소
  ======================================================= */

  if (
    !part ||
    !topic
  ) {
    return (
      <main className="app">
        <p>
          해당 목차를 찾을 수
          없습니다.
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


  /* =======================================================
     화면
  ======================================================= */

  return (
    <main className="app topic-page">

      {/* 뒤로 */}

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


      {/* 제목 */}

      <header className="topic-header">
        <span className="part-label">
          PART{" "}
          {partNumber + 1}
        </span>

        <h1>
          {topic.title}
        </h1>
        {/* 
        {topic.note && (
          <p className="topic-note">
            {topic.note}
          </p>
        )} */}
      </header>


      {/* 전체 열기 / 닫기 */}

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


      {/* 목차 */}

      <section className="outline-container">

        {topic.children &&
          topic.children.length >
          0 ? (
          topic.children.map(
            (
              node,
              index
            ) => {
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

                  memos={
                    memos
                  }

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
            등록된 목차가
            없습니다.
          </div>
        )}

      </section>
    </main>
  );
}


export default TopicPage;