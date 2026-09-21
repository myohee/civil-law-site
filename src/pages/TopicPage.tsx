import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import civilData from "../data/civil_outline_complete.json";

type OutlineNode = {
  title: string;
  children?: OutlineNode[];
  note?: string;
};

type MemoMap = Record<string, string>;

type OutlineItemProps = {
  node: OutlineNode;
  depth: number;
  index: number;
  path: string;

  openItems: Set<string>;
  toggleItem: (path: string) => void;

  editingMemos: Set<string>;
  toggleMemoEditor: (path: string) => void;

  memos: MemoMap;
  updateMemo: (path: string, text: string) => void;
};


/* =========================
   목차 번호
   1. → (1) → 1) → ①
========================= */

function getNumber(depth: number, index: number) {
  const number = index + 1;

  if (depth === 0) return `${number}.`;
  if (depth === 1) return `(${number})`;
  if (depth === 2) return `${number})`;

  if (depth === 3) {
    const circledNumbers = [
      "①", "②", "③", "④", "⑤",
      "⑥", "⑦", "⑧", "⑨", "⑩",
      "⑪", "⑫", "⑬", "⑭", "⑮",
      "⑯", "⑰", "⑱", "⑲", "⑳",
    ];

    return circledNumbers[index] ?? `${number}`;
  }

  return `${number}.`;
}


/* =========================
   메모 편집창
========================= */

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

  /* =========================
     기본 설정
  ========================= */

  const INDENT = "    ";

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
    textareaRef.current?.focus();
  }, []);


  /* =========================
     커서 위치 변경
  ========================= */

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


  /* =========================
     현재 줄 분석
  ========================= */

  const getCurrentLine = (
    textarea: HTMLTextAreaElement
  ) => {
    const start =
      textarea.selectionStart;

    const beforeCursor =
      value.slice(0, start);

    const lineStart =
      beforeCursor.lastIndexOf("\n") + 1;

    const nextLineBreak =
      value.indexOf("\n", start);

    const lineEnd =
      nextLineBreak === -1
        ? value.length
        : nextLineBreak;

    const line =
      value.slice(
        lineStart,
        lineEnd
      );

    return {
      start,
      lineStart,
      lineEnd,
      line,
    };
  };


  /* =========================
     한 줄의 목록 형식 분석

     지원:
     1.
     (1)
     1)
     -
  ========================= */

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


  /* =========================
     Enter

     1. → 2.
     (1) → (2)
     1) → 2)
     - → -
  ========================= */

  const handleEnter = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea =
      event.currentTarget;

    const {
      start,
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


    /*
      -------------------------
      내용 없는 목록에서 Enter

      3. |
      (3) |
      3) |
      - |

      → 목록 종료
      -------------------------
    */

    if (
      parsed.content.trim() === ""
    ) {
      const beforeLine =
        value.slice(
          0,
          lineStart
        );

      const afterCursor =
        value.slice(start);

      /*
        목록 기호는 없애되
        현재 들여쓰기는 유지
      */

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


    /*
      -------------------------
      다음 목록 만들기
      -------------------------
    */

    let nextPrefix = "";


    if (
      parsed.type === "level1"
    ) {
      nextPrefix =
        `${parsed.indent}${
          parsed.number! + 1
        }. `;
    }


    if (
      parsed.type === "level2"
    ) {
      nextPrefix =
        `${parsed.indent}(${
          parsed.number! + 1
        }) `;
    }


    if (
      parsed.type === "level3"
    ) {
      nextPrefix =
        `${parsed.indent}${
          parsed.number! + 1
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

    const selectionEnd =
      textarea.selectionEnd;

    const newValue =
      value.slice(0, start) +
      insertion +
      value.slice(selectionEnd);

    onChange(newValue);

    moveCursor(
      textarea,
      start +
        insertion.length
    );
  };


  /* =========================
     Tab

     1. → (1) → 1)

     Shift + Tab은 반대
  ========================= */

  const handleTab = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea =
      event.currentTarget;

    const {
      lineStart,
      lineEnd,
      line,
    } =
      getCurrentLine(textarea);

    const parsed =
      parseLine(line);

    event.preventDefault();


    /*
      =========================
      목록 형식이 아닌 일반 문장

      → 그냥 들여쓰기
    =========================
    */

    if (!parsed) {
      const start =
        textarea.selectionStart;

      const end =
        textarea.selectionEnd;


      /*
        Shift + Tab
        앞에 공백이 있으면 제거
      */

      if (event.shiftKey) {
        const before =
          value.slice(
            0,
            lineStart
          );

        const currentLine =
          value.slice(
            lineStart,
            lineEnd
          );

        let removeCount = 0;

        if (
          currentLine.startsWith(
            INDENT
          )
        ) {
          removeCount =
            INDENT.length;
        } else {
          const spaces =
            currentLine.match(
              /^ +/
            )?.[0].length ?? 0;

          removeCount =
            Math.min(
              spaces,
              INDENT.length
            );
        }

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
          before +
          newLine +
          value.slice(lineEnd);

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


      /*
        일반 문장에서 Tab
        → 공백 4칸
      */

      const insertion =
        INDENT;

      const newValue =
        value.slice(0, start) +
        insertion +
        value.slice(end);

      onChange(newValue);

      moveCursor(
        textarea,
        start +
          insertion.length
      );

      return;
    }


    /* =========================
       - 목록

       - 는 숫자 계층과 별개

       Tab → 들여쓰기
       Shift+Tab → 내어쓰기
    ========================= */

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
        `${newIndent}- ${
          parsed.content
        }`;

      const newValue =
        value.slice(
          0,
          lineStart
        ) +
        newLine +
        value.slice(lineEnd);

      onChange(newValue);


      const difference =
        newLine.length -
        line.length;

      const oldPosition =
        textarea.selectionStart;

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


    /* =========================
       숫자 목록

       Tab:
       1. → (1) → 1)

       Shift+Tab:
       1) → (1) → 1.
    ========================= */

    let newLine = "";


    /*
      -------------------------
      Tab
      -------------------------
    */

    if (!event.shiftKey) {

      /*
        1. → (1)
      */

      if (
        parsed.type === "level1"
      ) {
        newLine =
          `${parsed.indent}${INDENT}` +
          `(1) ${parsed.content}`;
      }


      /*
        (1) → 1)
      */

      else if (
        parsed.type === "level2"
      ) {
        newLine =
          `${parsed.indent}${INDENT}` +
          `1) ${parsed.content}`;
      }


      /*
        이미 1) 단계

        → 더 깊은 숫자 단계는 없으므로
          공백만 한 단계 추가
      */

      else if (
        parsed.type === "level3"
      ) {
        newLine =
          `${parsed.indent}${INDENT}` +
          `${parsed.number}) ` +
          parsed.content;
      }

    }


    /*
      -------------------------
      Shift + Tab
      -------------------------
    */

    else {

      /*
        1) → (1)
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


      /*
        (1) → 1.
      */

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


      /*
        1. 단계에서는
        형식은 유지하고
        들여쓰기만 제거
      */

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
          `${newIndent}${
            parsed.number
          }. ${parsed.content}`;
      }

    }


    if (!newLine) {
      return;
    }


    /* =========================
       현재 줄 교체
    ========================= */

    const oldCursorPosition =
      textarea.selectionStart;

    const cursorOffset =
      oldCursorPosition -
      lineStart;

    const newValue =
      value.slice(
        0,
        lineStart
      ) +
      newLine +
      value.slice(lineEnd);

    onChange(newValue);


    /*
      제목 내용에서의 커서 위치를
      최대한 유지
    */

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


  /* =========================
     키보드 처리
  ========================= */

  const handleKeyDown = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {

    if (event.key === "Tab") {
      handleTab(event);
      return;
    }

    if (event.key === "Enter") {
      handleEnter(event);
    }
  };


  /* =========================
     textarea
  ========================= */

  return (
    <textarea
      ref={textareaRef}
      className="memo-editor"
      value={value}
      rows={1}
      placeholder="내용을 입력하세요..."

      onKeyDown={
        handleKeyDown
      }

      onChange={(event) => {
        onChange(
          event.target.value
        );

        requestAnimationFrame(
          resizeTextarea
        );
      }}
    />
  );
}


/* =========================
   목차 항목 하나
========================= */

function OutlineItem({
  node,
  depth,
  index,
  path,
  openItems,
  toggleItem,
  editingMemos,
  toggleMemoEditor,
  memos,
  updateMemo,
}: OutlineItemProps) {

  /* JSON상의 하위 목차가 있는지 */
  const hasChildren =
    Boolean(
      node.children &&
      node.children.length > 0
    );

  /* 저장된 메모 */
  const memo = memos[path] ?? "";

  const hasMemo =
    memo.trim().length > 0;

  /*
    핵심!

    하위 목차가 있거나
    작성된 메모가 있으면
    > 토글을 표시
  */
  const hasExpandableContent =
    hasChildren || hasMemo;


  const isOpen =
    openItems.has(path);

  const isEditingMemo =
    editingMemos.has(path);


  return (
    <div
      className={`outline-level outline-level-${depth}`}
    >

      {/* =====================
          목차 한 줄
      ===================== */}

      <div className="outline-row">

        {/* 번호 */}
        <span className="outline-number">
          {getNumber(depth, index)}
        </span>


        {/* 제목
            클릭 = 메모 작성/수정
        */}
        <button
          type="button"
          className="outline-title-button"
          onClick={() => {
            toggleMemoEditor(path);
          }}
        >
          {node.title}
        </button>


        {/* 오른쪽 토글
            하위목차 OR 메모가 있을 때만 존재
        */}
        <div className="outline-action">

          {hasExpandableContent && (
            <button
              type="button"
              className={`outline-toggle ${
                isOpen ? "open" : ""
              }`}
              onClick={() => {
                toggleItem(path);
              }}
              aria-label={
                isOpen
                  ? "내용 닫기"
                  : "내용 열기"
              }
            >
              ›
            </button>
          )}

        </div>
      </div>


      {/* =====================
          메모 편집 중

          제목을 눌렀을 때는
          토글 상태와 관계없이 표시
      ===================== */}

      {isEditingMemo && (
        <div
          className="outline-memo"
          style={{
            marginLeft:
              `${depth * 24 + 38}px`,
          }}
        >
          <MemoEditor
            value={memo}
            onChange={(text) => {
              updateMemo(path, text);
            }}
          />
        </div>
      )}


      {/* =====================
          토글로 펼친 내용
      ===================== */}

      {isOpen && (
        <div className="outline-expanded-content">

          {/* 저장된 메모

              현재 메모를 편집 중이라면
              위의 textarea가 이미 있으므로
              중복 표시하지 않음
          */}

          {hasMemo && !isEditingMemo && (
            <div
              className="outline-memo"
              style={{
                marginLeft:
                  `${depth * 24 + 38}px`,
              }}
            >
              <div
                className="memo-display"
                onClick={() => {
                  toggleMemoEditor(path);
                }}
                title="클릭하여 메모 수정"
              >
                {memo}
              </div>
            </div>
          )}


          {/* JSON 자체에 들어 있는 note */}

          {node.note && (
            <div
              className="outline-note"
              style={{
                marginLeft:
                  `${depth * 24 + 38}px`,
              }}
            >
              {node.note}
            </div>
          )}


          {/* 하위 목차 */}

          {hasChildren && (
            <div className="outline-children">

              {node.children!.map(
                (child, childIndex) => {

                  const childPath =
                    `${path}-${childIndex}`;

                  return (
                    <OutlineItem
                      key={childPath}
                      node={child}
                      depth={depth + 1}
                      index={childIndex}
                      path={childPath}

                      openItems={openItems}
                      toggleItem={toggleItem}

                      editingMemos={editingMemos}
                      toggleMemoEditor={
                        toggleMemoEditor
                      }

                      memos={memos}
                      updateMemo={updateMemo}
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


/* =========================
   Topic Page
========================= */

function TopicPage() {
  const navigate = useNavigate();

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
    part?.topics[
      topicNumber
    ] as OutlineNode | undefined;


  /* =========================
     펼쳐진 항목
  ========================= */

  const [
    openItems,
    setOpenItems,
  ] = useState<Set<string>>(
    new Set()
  );


  /* =========================
     메모 편집 중인 항목
  ========================= */

  const [
    editingMemos,
    setEditingMemos,
  ] = useState<Set<string>>(
    new Set()
  );


  /* =========================
     메모 저장
  ========================= */

  const memoStorageKey =
    `civil-memos-${partNumber}-${topicNumber}`;

  const [
    memos,
    setMemos,
  ] = useState<MemoMap>(() => {
    try {
      const saved =
        localStorage.getItem(
          memoStorageKey
        );

      if (!saved) {
        return {};
      }

      return JSON.parse(saved);
    } catch {
      return {};
    }
  });


  /* =========================
     잘못된 URL
  ========================= */

  if (!part || !topic) {
    return (
      <main className="app">

        <p>
          해당 목차를 찾을 수 없습니다.
        </p>

        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          홈으로
        </button>

      </main>
    );
  }


  /* =========================
     토글 열기 / 닫기
  ========================= */

  const toggleItem = (
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


  /* =========================
     메모 편집 열기 / 닫기
  ========================= */

  const toggleMemoEditor = (
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


  /* =========================
     메모 수정 + 자동 저장
  ========================= */

  const updateMemo = (
    path: string,
    text: string
  ) => {
    setMemos((previous) => {

      const next = {
        ...previous,
      };

      /*
        내용이 완전히 비어 있으면
        해당 메모 자체를 삭제

        → 하위 목차도 없다면
          > 버튼도 자동으로 사라짐
      */
      if (text.trim().length === 0) {
        delete next[path];
      } else {
        next[path] = text;
      }

      localStorage.setItem(
        memoStorageKey,
        JSON.stringify(next)
      );

      return next;
    });
  };


  /* =========================
     모든 펼칠 수 있는 항목 찾기

     중요:
     하위목차뿐 아니라
     메모가 있는 항목도 포함
  ========================= */

  const collectExpandablePaths = (
    nodes: OutlineNode[],
    parentPath = ""
  ) => {
    const paths: string[] = [];

    nodes.forEach(
      (node, index) => {

        const currentPath =
          parentPath
            ? `${parentPath}-${index}`
            : `${index}`;

        const nodeHasChildren =
          Boolean(
            node.children &&
            node.children.length > 0
          );

        const nodeHasMemo =
          Boolean(
            memos[currentPath]?.trim()
          );

        if (
          nodeHasChildren ||
          nodeHasMemo
        ) {
          paths.push(currentPath);
        }

        if (
          node.children &&
          node.children.length > 0
        ) {
          paths.push(
            ...collectExpandablePaths(
              node.children,
              currentPath
            )
          );
        }
      }
    );

    return paths;
  };


  /* =========================
     모두 열기
  ========================= */

  const openAll = () => {
    const paths =
      collectExpandablePaths(
        topic.children ?? []
      );

    setOpenItems(
      new Set(paths)
    );

    /*
      편집창은 닫고
      저장된 메모 형태로 보여줌
    */
    setEditingMemos(
      new Set()
    );
  };


  /* =========================
     모두 닫기
  ========================= */

  const closeAll = () => {
    setOpenItems(
      new Set()
    );

    setEditingMemos(
      new Set()
    );
  };


  /* =========================
     화면
  ========================= */

  return (
    <main
      className="app topic-page"
    >

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
          {part.title}
        </span>

        <h1>
          {topic.title}
        </h1>

        {topic.note && (
          <p className="topic-note">
            {topic.note}
          </p>
        )}

      </header>


      <div className="outline-controls">

        <button
          type="button"
          onClick={openAll}
        >
          모두 열기
        </button>

        <button
          type="button"
          onClick={closeAll}
        >
          모두 닫기
        </button>

      </div>


      <section className="outline-container">

        {topic.children &&
        topic.children.length > 0 ? (

          topic.children.map(
            (node, index) => (

              <OutlineItem
                key={index}

                node={node}
                depth={0}
                index={index}
                path={`${index}`}

                openItems={openItems}
                toggleItem={toggleItem}

                editingMemos={editingMemos}
                toggleMemoEditor={
                  toggleMemoEditor
                }

                memos={memos}
                updateMemo={updateMemo}
              />

            )
          )

        ) : (

          <p className="empty-outline">
            하위 목차가 없습니다.
          </p>

        )}

      </section>

    </main>
  );
}

export default TopicPage;