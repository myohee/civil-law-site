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

  saveMemoDirectly: (
    path: string,
    value: string
  ) => void;

  syncMemo: (
    path: string,
    value: string
  ) => void;
};

const articles =
  civilArticles as Record<string, Article>;


/* =========================================================
   목차 번호
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
   메모 표시

   @245
   @245의2

   → 조문으로 변환
========================================================= */

function MemoDisplay({
  text,
}: {
  text: string;
}) {
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
              key={index}
              className="article-box"
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

   중요:
   uncontrolled textarea 사용

   입력 중 React state를 변경하지 않아서
   iPad Safari에서 페이지 전체가
   매 글자마다 재렌더링되는 것을 방지
========================================================= */

type MemoEditorProps = {
  initialValue: string;

  onSaveDirectly: (
    value: string
  ) => void;

  onSync: (
    value: string
  ) => void;
};


function MemoEditor({
  initialValue,
  onSaveDirectly,
  onSync,
}: MemoEditorProps) {
  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const isComposingRef =
    useRef(false);

  const INDENT = "    ";


  /* =======================================================
     최초 높이 설정

     입력할 때마다 height를 재계산하지 않습니다.
     메모를 처음 열었을 때만 기존 내용에 맞춤.
  ======================================================= */

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height =
      `${Math.max(
        textarea.scrollHeight,
        44
      )}px`;
  }, []);


  /* =======================================================
     localStorage 저장

     React state는 건드리지 않음
  ======================================================= */

  const saveCurrentValue = (
    textarea: HTMLTextAreaElement
  ) => {
    onSaveDirectly(
      textarea.value
    );
  };


  /* =======================================================
     필요한 경우에만 아래쪽으로 높이 증가

     height = auto를 사용하지 않음
  ======================================================= */

  const growIfNeeded = (
    textarea: HTMLTextAreaElement
  ) => {
    const currentHeight =
      textarea.getBoundingClientRect().height;

    const requiredHeight =
      textarea.scrollHeight;

    if (
      requiredHeight >
      currentHeight + 1
    ) {
      textarea.style.height =
        `${requiredHeight}px`;
    }
  };


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

      growIfNeeded(textarea);
    });
  };


  /* =======================================================
     현재 줄 정보
  ======================================================= */

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
      currentValue.slice(
        0,
        start
      );

    const lineStart =
      beforeCursor.lastIndexOf(
        "\n"
      ) + 1;

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
     목록 분석
  ======================================================= */

  const parseLine = (
    line: string
  ) => {
    /*
      1.
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
      (1)
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
      1)
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
      -
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
     textarea 값을 직접 변경

     React state를 거치지 않음
  ======================================================= */

  const replaceValue = (
    textarea: HTMLTextAreaElement,
    newValue: string,
    newCursorPosition: number
  ) => {
    textarea.value =
      newValue;

    /*
      localStorage에는 즉시 저장
    */

    saveCurrentValue(
      textarea
    );

    moveCursor(
      textarea,
      newCursorPosition
    );
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
      기본 Enter 동작 사용
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
      getCurrentLine(
        textarea
      );


    const parsed =
      parseLine(line);


    /*
      일반 문장은
      기본 Enter
    */

    if (!parsed) {
      return;
    }


    event.preventDefault();


    /* =====================================================
       빈 목록 → 목록 종료
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
        currentValue.slice(
          end
        );

      const newValue =
        beforeLine +
        parsed.indent +
        afterCursor;

      const newCursorPosition =
        beforeLine.length +
        parsed.indent.length;

      replaceValue(
        textarea,
        newValue,
        newCursorPosition
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
        `${parsed.indent}${parsed.number! + 1}. `;
    }


    if (
      parsed.type === "level2"
    ) {
      nextPrefix =
        `${parsed.indent}(${parsed.number! + 1}) `;
    }


    if (
      parsed.type === "level3"
    ) {
      nextPrefix =
        `${parsed.indent}${parsed.number! + 1}) `;
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
      currentValue.slice(
        end
      );


    replaceValue(
      textarea,
      newValue,
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
      getCurrentLine(
        textarea
      );


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


        replaceValue(
          textarea,
          newValue,
          Math.max(
            lineStart,
            start -
            removeCount
          )
        );

        return;
      }


      /*
        일반 Tab
      */

      const newValue =
        currentValue.slice(
          0,
          start
        ) +
        INDENT +
        currentValue.slice(
          end
        );


      replaceValue(
        textarea,
        newValue,
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
        newIndent +=
          INDENT;
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


      const difference =
        newLine.length -
        line.length;


      replaceValue(
        textarea,
        newValue,
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
          `${parsed.number}) ${parsed.content}`;
      }
    }


    /*
      Shift + Tab

      1) → (1) → 1.
    */

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
          `${newIndent}(1) ${parsed.content}`;
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
          `${newIndent}1. ${parsed.content}`;
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


    replaceValue(
      textarea,
      newValue,
      newCursorPosition
    );
  };


  /* =======================================================
     KeyDown
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


    if (
      event.key === "Tab"
    ) {
      handleTab(event);
      return;
    }


    if (
      event.key === "Enter"
    ) {
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

      defaultValue={
        initialValue
      }

      rows={1}

      placeholder={
        "내용을 입력하세요...  조문은 @245처럼 입력"
      }


      /* =====================
         한글 조합 시작
      ===================== */

      onCompositionStart={() => {
        isComposingRef.current =
          true;
      }}


      /* =====================
         한글 조합 종료

         localStorage에만 저장
         React state 변경 X
      ===================== */

      onCompositionEnd={(
        event
      ) => {
        isComposingRef.current =
          false;

        saveCurrentValue(
          event.currentTarget
        );
      }}


      onKeyDown={
        handleKeyDown
      }


      /* =====================
         일반 입력

         React state 변경 X
         localStorage만 저장
      ===================== */

      onInput={(event) => {
        const textarea =
          event.currentTarget;

        saveCurrentValue(
          textarea
        );

        growIfNeeded(
          textarea
        );
      }}


      /* =====================
         메모칸에서 나갈 때
         React state와 최종 동기화
      ===================== */

      onBlur={(event) => {
        onSync(
          event.currentTarget.value
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

  saveMemoDirectly,
  syncMemo,
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


        {/* > 클릭 → 하위 내용 */}

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
            initialValue={
              memo
            }

            onSaveDirectly={(
              value
            ) =>
              saveMemoDirectly(
                path,
                value
              )
            }

            onSync={(
              value
            ) =>
              syncMemo(
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


          {/* JSON note */}

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

                      node={
                        child
                      }

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

                      saveMemoDirectly={
                        saveMemoDirectly
                      }

                      syncMemo={
                        syncMemo
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
     localStorage
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


  /*
    최신 메모 내용을 React render 없이
    보관하기 위한 ref

    입력 중에는 이것만 변경됩니다.
  */

  const memosRef =
    useRef<MemoMap>({});


  /* =======================================================
     메모 불러오기
  ======================================================= */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        storageKey
      );


    if (!saved) {
      memosRef.current =
        {};

      setMemos({});

      return;
    }


    try {
      const parsed =
        JSON.parse(saved) as MemoMap;

      memosRef.current =
        parsed;

      setMemos(
        parsed
      );
    } catch {
      memosRef.current =
        {};

      setMemos({});
    }
  }, [storageKey]);


  /* =======================================================
     입력 중 즉시 저장

     중요:
     setMemos()를 호출하지 않습니다.

     따라서 글자 하나 입력할 때마다
     TopicPage 전체가 재렌더링되지 않습니다.
  ======================================================= */

  const saveMemoDirectly = (
    path: string,
    text: string
  ) => {
    const next = {
      ...memosRef.current,
    };


    if (
      text.trim().length === 0
    ) {
      delete next[path];
    } else {
      next[path] =
        text;
    }


    memosRef.current =
      next;


    localStorage.setItem(
      storageKey,
      JSON.stringify(next)
    );
  };


  /* =======================================================
     메모 편집이 끝났을 때
     React state와 동기화
  ======================================================= */

  const syncMemo = (
    path: string,
    text: string
  ) => {
    saveMemoDirectly(
      path,
      text
    );

    setMemos({
      ...memosRef.current,
    });
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
    /*
      메모를 닫기 직전이라면
      textarea의 blur가 먼저 발생하면서
      syncMemo가 최신 값을 state에 반영합니다.
    */

    setEditingMemos(
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
            memosRef.current[
              path
            ]?.trim()
          );


        const hasNote =
          Boolean(
            node.note
          );


        if (
          hasChildren ||
          hasMemo ||
          hasNote
        ) {
          paths.push(
            path
          );
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
    if (!topic) {
      return;
    }


    /*
      혹시 편집 중인 메모가 있으면
      최신 ref를 state에 반영
    */

    setMemos({
      ...memosRef.current,
    });


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
    setMemos({
      ...memosRef.current,
    });


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

  const hasPreviousTopic =
    topicNumber > 0;

  const hasNextTopic =
    topicNumber <
    part.topics.length - 1;


  const goToPreviousTopic = () => {
    if (!hasPreviousTopic) {
      return;
    }

    navigate(
      `/part/${partNumber}/topic/${topicNumber - 1}`
    );

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };


  const goToNextTopic = () => {
    if (!hasNextTopic) {
      return;
    }

    navigate(
      `/part/${partNumber}/topic/${topicNumber + 1}`
    );

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  };

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
      </header>


      {/* 전체 열기 / 닫기 */}

      <div className="outline-controls">
        <button
          type="button"
          onClick={
            openAll
          }
        >
          전체 열기
        </button>

        <button
          type="button"
          onClick={
            closeAll
          }
        >
          전체 닫기
        </button>
      </div>


      {/* 목차 */}

      <section className="outline-container">

        {topic.children &&
          topic.children.length > 0 ? (

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

                  saveMemoDirectly={
                    saveMemoDirectly
                  }

                  syncMemo={
                    syncMemo
                  }
                />
              );
            }
          )

        ) : (

          <div className="empty-topic-memo">

            <MemoEditor
              initialValue={
                memos["topic"] ?? ""
              }

              onSaveDirectly={(
                value
              ) =>
                saveMemoDirectly(
                  "topic",
                  value
                )
              }

              onSync={(
                value
              ) =>
                syncMemo(
                  "topic",
                  value
                )
              }
            />

          </div>

        )}

      </section>

      <nav
        className="topic-navigation"
        aria-label="목차 이동"
      >
        <button
          type="button"
          className="topic-navigation-button"
          onClick={goToPreviousTopic}
          disabled={!hasPreviousTopic}
        >
          <span className="topic-navigation-direction">
            ← 
          </span>

          <span className="topic-navigation-title">
            {hasPreviousTopic
              ? part.topics[
                topicNumber - 1
              ].title
              : "이전 목차 없음"}
          </span>
        </button>


        <button
          type="button"
          className="topic-navigation-button topic-navigation-next"
          onClick={goToNextTopic}
          disabled={!hasNextTopic}
        >
          <span className="topic-navigation-title">
            {hasNextTopic
              ? part.topics[
                topicNumber + 1
              ].title
              : "다음 목차 없음"}
          </span>
          <span className="topic-navigation-direction">
             →
          </span>
        </button>
      </nav>
    </main>
  );
}


export default TopicPage;