// dot-vote feature の公開境界。外から使えるのはここに並ぶものだけ。
// （DotVoteButton は DotVoteControls の内部部品なので公開しない）
export {
  DotVoteControls,
  type DotVoteRemaining,
} from "./dot-vote-controls";
export { DotVoteSummary } from "./dot-vote-summary";
