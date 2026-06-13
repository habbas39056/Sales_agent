const fs = require('fs');
const path = require('path');

const directories = ['./frontend/src/pages', './frontend/src/components'];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Pattern 1: Literal $ before JS interpolation in template strings (e.g. `$${value}`)
    content = content.replace(/`\$\$\{/g, '`PKR ${');

    // Pattern 2: Literal $ before JS expression in JSX (e.g. <h3>${value}</h3> -> <h3>PKR {value}</h3>)
    content = content.replace(/>\$\{/g, '>PKR {');
    content = content.replace(/>\s*\$\{/g, '>PKR {');

    // Pattern 3: Literal $ with numbers in JSX (e.g. <td>$100</td> -> <td>PKR 100</td>)
    content = content.replace(/>\$(\d+)/g, '>PKR $1');

    // Pattern 4: " ($)" in text (e.g. Invoiced ($) -> Invoiced (PKR))
    content = content.replace(/\(\$\)/g, '(PKR)');

    // Pattern 5: Quotes with $ (e.g. "Total: $" -> "Total: PKR ")
    content = content.replace(/:\s*\$`/g, ': PKR `');
    content = content.replace(/:\s*\$'/g, ': PKR \'');
    content = content.replace(/:\s*\$"/g, ': PKR "');
    content = content.replace(/Total:\s*\$/gi, 'Total: PKR ');

    // Pattern 6: Some stray $${...} might have spaces like `$ ${`
    content = content.replace(/`\$\s+\$\{/g, '`PKR ${');

    // Specific cases in Expenses.jsx for PDF generation:
    // doc.text(`Cash in Hand: $${...}`) -> already handled by Pattern 1.
    // `$${Number(exp.receipt_amount...` -> already handled by Pattern 1.

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Updated currency in ${file}`);
    }
  });
});

console.log("Currency replacement script complete.");
