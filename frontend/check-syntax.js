import fs from 'fs';
import { parse } from '@babel/parser';

try {
  const code = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("No syntax errors found!");
} catch (e) {
  console.log("Syntax Error Context:");
  console.log(e.message);
  if (e.loc) {
    console.log("Line " + e.loc.line + ", Col " + e.loc.column);
  }
}
