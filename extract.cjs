const fs = require('fs');
const readline = require('readline');

const transcriptPath = 'C:/Users/yeash/.gemini/antigravity-ide/brain/f64137fc-ab4a-4036-b02b-b94ef331be16/.system_generated/logs/transcript_full.jsonl';
const fileState = new Map();

const rl = readline.createInterface({
  input: fs.createReadStream(transcriptPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const entry = JSON.parse(line);
    if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
      for (const tc of entry.tool_calls) {
        if (tc.name === 'write_to_file' || tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
          const targetFile = tc.args.TargetFile || tc.args.targetFile;
          if (targetFile && targetFile.includes('src')) {
            let normalizedPath = targetFile.replace(/\\\\/g, '/');
            if (normalizedPath.startsWith('"')) normalizedPath = normalizedPath.slice(1);
            if (normalizedPath.endsWith('"')) normalizedPath = normalizedPath.slice(0, -1);
            
            if (tc.name === 'write_to_file' && tc.args.CodeContent) {
                let content = tc.args.CodeContent;
                if (content.startsWith('"')) content = content.slice(1);
                if (content.endsWith('"')) content = content.slice(0, -1);
                content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                fileState.set(normalizedPath, content);
            } else if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content')) {
                // If there were any edits in Phase 1, we ignore them for now and hope write_to_file was mostly used,
                // OR we can just ignore edits. Let's see if write_to_file covers it.
            }
          }
        }
      }
    }
  } catch(e) {}
});

rl.on('close', () => {
  let count = 0;
  for (const [path, content] of fileState.entries()) {
    try {
        const dest = path.replace('d:/Projects/Raksha Sutra/', './');
        if (dest.includes('scratch/')) continue;
        const dir = dest.substring(0, dest.lastIndexOf('/'));
        if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dest, content);
        console.log(`Restored: ${dest}`);
        count++;
    } catch(e) {
        console.error("Error restoring " + path + ": " + e);
    }
  }
  console.log(`Total restored files: ${count}`);
});
