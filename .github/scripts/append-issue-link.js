function extractIssueNumber(branchRef) {
  if (!branchRef) {
    return null;
  }
  const match = branchRef.match(/\d+/);
  return match ? match[0] : null;
}

function issueLinkMarker(issueNumber) {
  return `<!-- issue-ref:${issueNumber} -->`;
}

function buildBodyWithIssueLink(currentBody, issueNumber) {
  const body = currentBody ?? "";
  const marker = issueLinkMarker(issueNumber);
  if (body.includes(marker)) {
    return null;
  }
  return `${body}\n\n${marker}\nCloses #${issueNumber}`;
}

module.exports = {
  extractIssueNumber,
  buildBodyWithIssueLink,
  issueLinkMarker,
};
