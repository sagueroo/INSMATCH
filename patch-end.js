const fs = require('fs');
let text = fs.readFileSync('frontend/src/components/Dashboard.jsx', 'utf8');
let newText = text.replace(/```/g, '');
fs.writeFileSync('frontend/src/components/Dashboard.jsx', newText, 'utf8');
console.log('Markdown removed!');
