function truncateFileList(files, maxLength) {
  if (files.length === 0) {
    return "(ファイルなし)";
  }

  const lines = files.map((file) => `- ${file}`);
  let text = "";
  let included = 0;

  for (; included < lines.length; included++) {
    const candidate =
      text === "" ? lines[included] : `${text}\n${lines[included]}`;
    const remainingAfter = lines.length - included - 1;
    const suffix = remainingAfter > 0 ? `\n…ほか${remainingAfter}件` : "";
    if (candidate.length + suffix.length > maxLength) {
      break;
    }
    text = candidate;
  }

  const remaining = lines.length - included;
  if (remaining > 0) {
    const suffix = `…ほか${remaining}件`;
    text = text === "" ? suffix : `${text}\n${suffix}`;
  }

  return text;
}

function buildDiscordPayload({
  number,
  title,
  url,
  author,
  baseRef,
  headRef,
  files,
}) {
  return {
    embeds: [
      {
        title: `#${number} ${title}`,
        url,
        description: `\`${headRef}\` → \`${baseRef}\`\nby ${author}`,
        color: 0x57f287,
        fields: [
          {
            name: "変更ファイル",
            value: truncateFileList(files, 1024),
          },
        ],
      },
    ],
  };
}

module.exports = {
  buildDiscordPayload,
  truncateFileList,
};
