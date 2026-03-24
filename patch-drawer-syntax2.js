const fs = require('fs');
let text = fs.readFileSync('frontend/src/components/Dashboard.jsx', 'utf8');
// replace matching any newline sequence
let newText = text.replace(/        \/\/\s+━━━━━━━━━━━━ POPUP DETAIL ━━━━━━━━━━━━/, '  };\n\n        // ━━━━━━━━━━━━ POPUP DETAIL ━━━━━━━━━━━━');
// Wait, regex might be tricky. Let's just use split.

let lines = text.split(/\r?\n/);
let index = lines.findIndex(l => l.includes('POPUP DETAIL ━━━━━━━━━━━━'));
if (index !== -1) {
  // insert before the blank line before POPUP DETAIL
  lines.splice(index - 1, 0, '  };');
  fs.writeFileSync('frontend/src/components/Dashboard.jsx', lines.join('\n'), 'utf8');
  console.log('Fixed syntax at line ' + index);
} else {
  console.log('Could not find POPUP DETAIL');
}
