import { useRef, useState } from "react";

const BACKUP_TIME_KEY = "civil-last-backup-time";

type BackupData = {
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
};

function BackupControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lastBackupTime, setLastBackupTime] =
    useState<string | null>(() => {
      return localStorage.getItem(BACKUP_TIME_KEY);
    });

  /* =========================
     민법 사이트 데이터 수집
  ========================= */

  const collectCivilData = () => {
    const data: Record<string, string> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!key) continue;

      /*
        현재 민법 메모의 저장 형식:

        civil-memos-0-0
        civil-memos-0-1
        civil-memos-1-0
        ...
      */

      if (key.startsWith("civil-memos-")) {
        const value = localStorage.getItem(key);

        if (value !== null) {
          data[key] = value;
        }
      }
    }

    return data;
  };


  /* =========================
     백업 파일 다운로드
  ========================= */

  const handleBackup = () => {
    const now = new Date();

    const backup: BackupData = {
      version: 1,
      exportedAt: now.toISOString(),
      data: collectCivilData(),
    };

    const json = JSON.stringify(
      backup,
      null,
      2
    );

    const blob = new Blob(
      [json],
      {
        type: "application/json",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    /*
      파일 이름 예:
      civil-law-backup-2026-09-22.json
    */

    const date =
      now.toISOString().slice(0, 10);

    link.href = url;

    link.download =
      `civil-law-backup-${date}.json`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);


    /*
      마지막 백업 시각 저장
    */

    const backupTime =
      now.toISOString();

    localStorage.setItem(
      BACKUP_TIME_KEY,
      backupTime
    );

    setLastBackupTime(
      backupTime
    );
  };


  /* =========================
     백업 파일 선택
  ========================= */

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };


  /* =========================
     백업 복원
  ========================= */

  const handleRestore = async (
    event:
      React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      const text =
        await file.text();

      const backup =
        JSON.parse(text) as BackupData;


      /*
        백업 파일 기본 검증
      */

      if (
        backup.version !== 1 ||
        !backup.data ||
        typeof backup.data !== "object"
      ) {
        alert(
          "올바른 민법 백업 파일이 아닙니다."
        );

        return;
      }


      /*
        민법 데이터인지 한 번 더 확인

        다른 JSON 파일을 잘못 선택해도
        아무 localStorage나 덮어쓰지 않게 함
      */

      const entries =
        Object.entries(backup.data);

      const invalidKey =
        entries.some(
          ([key]) =>
            !key.startsWith(
              "civil-memos-"
            )
        );

      if (invalidKey) {
        alert(
          "민법 사이트의 백업 파일이 아닙니다."
        );

        return;
      }


      const confirmed =
        window.confirm(
          "현재 저장된 민법 메모를 백업 파일의 내용으로 복원할까요?\n\n기존 메모는 백업 파일의 내용으로 교체됩니다."
        );

      if (!confirmed) {
        return;
      }


      /*
        기존 민법 메모 삭제
      */

      const keysToRemove:
        string[] = [];

      for (
        let i = 0;
        i < localStorage.length;
        i++
      ) {
        const key =
          localStorage.key(i);

        if (
          key?.startsWith(
            "civil-memos-"
          )
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(
        (key) => {
          localStorage.removeItem(key);
        }
      );


      /*
        백업 데이터 복원
      */

      entries.forEach(
        ([key, value]) => {
          localStorage.setItem(
            key,
            value
          );
        }
      );


      alert(
        "백업을 복원했습니다."
      );


      /*
        페이지 새로고침
        → 복원된 메모를 즉시 반영
      */

      window.location.reload();

    } catch {
      alert(
        "백업 파일을 읽을 수 없습니다."
      );
    } finally {

      /*
        같은 파일을 다시 선택할 수 있도록
        input 초기화
      */

      event.target.value = "";
    }
  };


  /* =========================
     마지막 백업 시각 표시
  ========================= */

  const formatBackupTime = (
    iso: string
  ) => {
    const date =
      new Date(iso);

    return date.toLocaleString(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };


  return (
    <section className="backup-section">

      <div className="backup-info">

        <div className="backup-title">
          메모 백업
        </div>


        {lastBackupTime && (
          <div className="backup-time">
            마지막 백업{" "}
            {formatBackupTime(
              lastBackupTime
            )}
          </div>
        )}

      </div>


      <div className="backup-actions">

        <button
          type="button"
          className="backup-button"
          onClick={
            handleBackup
          }
        >
          백업
        </button>

        <button
          type="button"
          className="restore-button"
          onClick={
            handleRestoreClick
          }
        >
          복원
        </button>

      </div>


      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={
          handleRestore
        }
        hidden
      />

    </section>
  );
}

export default BackupControls;