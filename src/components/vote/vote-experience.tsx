"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { IssuedBallotResponse } from "@/domain/ballots/service";
import type { ResolutionChoice, ResolutionResponse } from "@/domain/votes/presentation";
import { recordBrowserProductEvent } from "@/components/analytics/product-event";

import { ArrowRightIcon, RefreshIcon } from "../icons";
import { browserVotingApi, PublicApiError } from "./api";
import { VotePlayerCard } from "./player-card";
import { isBrowserReload, loadBallotForNavigation } from "./reload-workflow";

type Phase = "error" | "loading" | "result" | "submitting" | "voting";

interface VoteErrorState {
  code: string;
  message: string;
  retryChoice?: ResolutionChoice;
}

function publicError(error: unknown): VoteErrorState {
  if (error instanceof PublicApiError) {
    const messages: Record<string, string> = {
      BALLOT_EXPIRED: "这组对决已经过期，我们可以为你换一组。",
      EDITION_NOT_ACTIVE: "本期投票已经结束。",
      INFRASTRUCTURE_RATE_LIMITED: "操作有点快，请稍等片刻再试。",
      NO_ACTIVE_EDITION: "当前没有开放投票的榜单。",
      POOL_NOT_READY: "候选池还在准备中，请稍后再来。",
      VISITOR_DISABLED: "当前浏览器暂时无法继续投票。",
    };
    return { code: error.code, message: messages[error.code] ?? error.message };
  }
  return { code: "UNAVAILABLE", message: "加载失败，请检查网络后再试。" };
}

export function VoteExperience() {
  const [ballot, setBallot] = useState<IssuedBallotResponse | null>(null);
  const [error, setError] = useState<VoteErrorState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<ResolutionResponse | null>(null);
  const initialLoad = useRef<Promise<IssuedBallotResponse> | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const applyBallot = useCallback((next: IssuedBallotResponse) => {
    setBallot(next);
    setError(null);
    setResult(null);
    setPhase("voting");
  }, []);

  const loadInitial = useCallback(async () => {
    setPhase("loading");
    setError(null);
    initialLoad.current ??= loadBallotForNavigation({
      api: browserVotingApi,
      isReload: isBrowserReload(),
      storage: window.sessionStorage,
    });
    try {
      applyBallot(await initialLoad.current);
    } catch (caught) {
      setError(publicError(caught));
      setPhase("error");
    }
  }, [applyBallot]);

  useEffect(() => {
    let active = true;
    initialLoad.current ??= loadBallotForNavigation({
      api: browserVotingApi,
      isReload: isBrowserReload(),
      storage: window.sessionStorage,
    });
    initialLoad.current.then(
      (next) => {
        if (active) {
          applyBallot(next);
        }
      },
      (caught: unknown) => {
        if (active) {
          setError(publicError(caught));
          setPhase("error");
        }
      },
    );
    return () => {
      active = false;
    };
  }, [applyBallot]);

  useEffect(() => {
    if (phase === "result") {
      resultHeading.current?.focus();
    }
  }, [phase]);

  const choose = useCallback(
    async (choice: ResolutionChoice, allowRetry = false) => {
      if (!ballot || (!allowRetry && phase !== "voting")) {
        return;
      }
      setPhase("submitting");
      setError(null);
      try {
        const resolved = await browserVotingApi.resolve(ballot.ballot.id, choice);
        recordBrowserProductEvent({ eventType: "VOTE_RESULT_VIEW" });
        setResult(resolved);
        setPhase("result");
      } catch (caught) {
        const nextError = publicError(caught);
        setError({ ...nextError, retryChoice: choice });
        setPhase("error");
      }
    },
    [ballot, phase],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (phase !== "voting" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      const choice = event.key === "1" ? "LEFT" : event.key === "2" ? "RIGHT" : null;
      if (choice || event.key.toLowerCase() === "s") {
        event.preventDefault();
        void choose(choice ?? "SKIP");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choose, phase]);

  async function nextBallot() {
    recordBrowserProductEvent({ eventType: "NEXT_CLICK" });
    setPhase("loading");
    setError(null);
    try {
      applyBallot(await browserVotingApi.next());
    } catch (caught) {
      setError(publicError(caught));
      setPhase("error");
    }
  }

  async function retry() {
    if (error?.retryChoice && ballot) {
      await choose(error.retryChoice, true);
      return;
    }
    initialLoad.current = null;
    await loadInitial();
  }

  if (phase === "loading" && !ballot) {
    return <VoteLoading />;
  }

  if (phase === "error") {
    return (
      <section className="vote-state-panel" role="alert">
        <span className="eyebrow">暂时没有新对决</span>
        <h1>{error?.message ?? "请求暂时失败。"}</h1>
        <div className="vote-state-panel__actions">
          <button className="button button--primary" onClick={() => void retry()} type="button">
            <RefreshIcon />
            再试一次
          </button>
          <Link className="button button--ghost" href="/ranking">
            先看榜单
          </Link>
        </div>
      </section>
    );
  }

  if (!ballot) {
    return <VoteLoading />;
  }

  const resolvedChoice = result?.resolution.choice;
  const busy = phase === "submitting";

  return (
    <section className="vote-experience" aria-busy={busy}>
      <div className="vote-intro">
        <span className="eyebrow">第 {ballot.ballot.dailyOrdinal} 组 · 随机对决</span>
        <h1>{result ? "社区投票结果" : "二选一投票箱"}</h1>
      </div>

      <div className="vote-matchup">
        <VotePlayerCard
          choice="LEFT"
          disabled={busy}
          onChoose={() => void choose("LEFT")}
          player={ballot.ballot.left}
          position="left"
          ranking={result?.left}
          resultChoice={resolvedChoice}
        />
        <div aria-hidden="true" className="versus-mark">
          <span>V</span>
          <span>S</span>
        </div>
        <VotePlayerCard
          choice="RIGHT"
          disabled={busy}
          onChoose={() => void choose("RIGHT")}
          player={ballot.ballot.right}
          position="right"
          ranking={result?.right}
          resultChoice={resolvedChoice}
        />
      </div>

      {result ? (
        <ResultPanel headingRef={resultHeading} result={result} onNext={() => void nextBallot()} />
      ) : (
        <div className="vote-controls">
          <button
            aria-keyshortcuts="S"
            className="skip-button"
            disabled={busy}
            onClick={() => void choose("SKIP")}
            type="button"
          >
            {busy ? "正在提交…" : "都不选，跳过"}
          </button>
          <p>键盘：1 选左 · 2 选右 · S 跳过</p>
        </div>
      )}
    </section>
  );
}

function ResultPanel({
  headingRef,
  onNext,
  result,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onNext(): void;
  result: ResolutionResponse;
}) {
  const hasDecisions = result.headToHead.countedDecisions > 0;
  const smallSample =
    result.headToHead.countedDecisions > 0 && result.headToHead.countedDecisions < 30;
  const leftPercent = Math.round((result.headToHead.leftWinPercent ?? 0) * 100);
  const rightPercent = Math.round((result.headToHead.rightWinPercent ?? 0) * 100);

  return (
    <div className="result-panel" aria-live="polite">
      <div className="result-panel__status">
        <span className="result-panel__check" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2 ref={headingRef} tabIndex={-1}>
            {result.resolution.counted || result.resolution.voteStatus === "THROTTLED"
              ? "这一票已计入社区榜"
              : "选择已记录，但本次不计榜"}
          </h2>
          <p>
            {result.resolution.counted || result.resolution.voteStatus === "THROTTLED"
              ? "胜者 +1，败者 -1。"
              : "这次选择保留在记录中，但不会改变双方分数。"}
          </p>
        </div>
      </div>

      <div className="h2h-result">
        <div className="h2h-result__header">
          <div>
            <span className="eyebrow">有效 H2H</span>
            <h3>{hasDecisions ? `${leftPercent}% · ${rightPercent}%` : "暂无有效对决"}</h3>
          </div>
          {smallSample ? <span className="sample-badge">样本较少</span> : null}
        </div>
        {hasDecisions ? (
          <div
            aria-label={`左侧 ${leftPercent}%，右侧 ${rightPercent}%`}
            className="h2h-bar"
            role="img"
          >
            <span style={{ width: `${leftPercent}%` }} />
          </div>
        ) : null}
        <p>
          {result.headToHead.countedDecisions.toLocaleString("zh-CN")} 次有效选择 ·{" "}
          {result.headToHead.countedSkips.toLocaleString("zh-CN")} 次跳过
        </p>
      </div>

      <button className="button button--primary result-panel__next" onClick={onNext} type="button">
        下一组
        <ArrowRightIcon />
      </button>
    </div>
  );
}

function VoteLoading() {
  return (
    <section aria-busy="true" aria-label="正在加载随机对决" className="vote-loading">
      <div className="vote-loading__heading" />
      <div className="vote-loading__cards">
        <div />
        <div />
      </div>
      <p>正在随机抽取两名选手…</p>
    </section>
  );
}
