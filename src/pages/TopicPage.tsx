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

  /*
    iPad / 한글 IME 대응

    compositionstart ~ compositionend 동안에는
    Enter / Tab 자동처리를 하지 않음
  */
  const isComposingRef =
    useRef(false);

  const INDENT = "    ";


  /* =========================
     textarea 높이 자동 조절
  ========================= */

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


  useEffect(() => {
    resizeTextarea();
  }, [value]);


  /* =========================
     커서 이동
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
     현재 줄 가져오기

     중요:
     React의 value가 아니라
     textarea.value를 사용

     → iPad에서 최신 입력값 기준
  ========================= */

  const getCurrentLine = (
    textarea: HTMLTextAreaElement
  ) => {
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


  /* =========================
     현재 줄의 목록 형식 분석
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
     Enter 처리
  ========================= */

  const handleEnter = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea =
      event.currentTarget;


    /*
      ★ iPad / 한글 입력 핵심

      글자가 아직 조합 중이면
      Enter를 절대 가로채지 않음.
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
      목록이 아닌 일반 문장은
      기본 Enter 사용
    */

    if (!parsed) {
      return;
    }


    event.preventDefault();


    /* =========================
       빈 목록에서 Enter

       3. |
       (3) |
       3) |
       - |

       → 목록 종료
    ========================= */

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


    /* =========================
       다음 목록 번호
    ========================= */

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


    const newValue =
      currentValue.slice(0, start) +
      insertion +
      currentValue.slice(end);


    onChange(newValue);


    moveCursor(
      textarea,
      start +
        insertion.length
    );
  };


  /* =========================
     Tab / Shift + Tab
  ========================= */

  const handleTab = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const textarea =
      event.currentTarget;


    /*
      한글 조합 중에는
      Tab 로직 실행하지 않음
    */

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


    /* =========================
       일반 문장
    ========================= */

    if (!parsed) {
      const start =
        textarea.selectionStart;

      const end =
        textarea.selectionEnd;


      /*
        Shift + Tab
      */

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


      /*
        일반 문장 + Tab
      */

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


    /* =========================
       - 목록

       - 는 번호 계층과 별개
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


    /* =========================
       번호 목록

       Tab
       1. → (1) → 1)

       Shift + Tab
       1) → (1) → 1.
    ========================= */

    let newLine = "";


    /* ---------- Tab ---------- */

    if (!event.shiftKey) {

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


    /* ------- Shift Tab ------- */

    else {

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


  /* =========================
     Keyboard
  ========================= */

  const handleKeyDown = (
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    /*
      ★ 조합 중인 키 입력은
      자동목록 로직에서 제외
    */

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


      /* =====================
         한글 IME 조합 상태
      ===================== */

      onCompositionStart={() => {
        isComposingRef.current =
          true;
      }}

      onCompositionEnd={(
        event
      ) => {
        isComposingRef.current =
          false;


        /*
          조합이 끝난 순간의
          실제 textarea 값을 저장

          iPad Safari에서
          React value가 한 박자 늦는 현상 방지
        */

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
        /*
          실제 DOM의 최신 값을 그대로 저장
        */

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