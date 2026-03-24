const fs = require('fs');
let text = fs.readFileSync('frontend/src/components/Dashboard.jsx', 'utf8');
text = text.replace(
  "        </div>\n        );\n\n  // ━━━━━━━━━━━━ POPUP DETAIL ━━━━━━━━━━━━",
  "        </div>\n        );\n  };\n\n  // ━━━━━━━━━━━━ POPUP DETAIL ━━━━━━━━━━━━"
);
fs.writeFileSync('frontend/src/components/Dashboard.jsx', text, 'utf8');
console.log("Syntax in drawer fixed.");
