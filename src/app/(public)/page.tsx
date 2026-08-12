import type { Metadata } from "next";

import { VoteExperience } from "@/components/vote/vote-experience";

export const metadata: Metadata = {
  title: "投票",
  description: "随机出现两名 CS 职业选手。选一个，或者跳过。",
};

export default function VotePage() {
  return (
    <main className="vote-page" id="main-content">
      <VoteExperience />
    </main>
  );
}
