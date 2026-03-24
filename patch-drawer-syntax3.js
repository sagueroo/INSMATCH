const fs = require('fs');
let lines = fs.readFileSync('frontend/src/components/Dashboard.jsx', 'utf8').split(/\r?\n/);
let index = lines.findIndex(l => l.includes('POPUP DETAIL ━━━━━━━━━━━━'));
if (index !== -1) {
  // We inserted '  };' at index - 2. Before it was '        );'
  // Actually, we want to replace:
  //         </div>
  //         );
  //   };
  // with
  //         </div>
  //       </div>
  //       );
  //   };
  
  // Let's just find the index of "        );" that comes before the popup detail
  let parenIndex = index;
  while (parenIndex > 0) {
    parenIndex--;
    if (lines[parenIndex].trim() === ');') {
      break;
    }
  }
  
  if (lines[parenIndex].trim() === ');') {
    lines.splice(parenIndex, 0, '      </div>');
    fs.writeFileSync('frontend/src/components/Dashboard.jsx', lines.join('\n'), 'utf8');
    console.log('Fixed wrapper div syntax at line ' + parenIndex);
  }
}
