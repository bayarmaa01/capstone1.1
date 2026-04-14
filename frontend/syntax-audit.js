const fs = require('fs');
const path = require('path');

// List of JSX files to check
const jsxFiles = [
  'src/App.jsx',
  'src/components/AddScheduleForm.jsx',
  'src/components/AttendanceChart.jsx',
  'src/components/AttendancePage.jsx',
  'src/components/AttendanceSession.jsx',
  'src/components/CameraCapture.jsx',
  'src/components/ClassSchedule.jsx',
  'src/components/ClassScheduleClean.jsx',
  'src/components/EnrollmentModal.jsx',
  'src/components/QRScanner.jsx',
  'src/components/ScheduleCalendar.jsx',
  'src/components/ScheduleModal.jsx',
  'src/pages/AttendanceAnalytics.jsx',
  'src/pages/AttendancePage.jsx',
  'src/pages/ClassDashboard.jsx',
  'src/pages/ClassPage.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/Login.jsx',
  'src/pages/LoginPage.jsx',
  'src/pages/StudentProfile.jsx'
];

console.log('🔍 Auditing frontend JSX files for syntax errors...\n');

let errorFiles = [];
let totalFiles = 0;

jsxFiles.forEach(filePath => {
  try {
    totalFiles++;
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax checks
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    const openTags = (content.match(/<[^\/][^>]*[^\/]>/g) || []).length;
    const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
    
    let hasError = false;
    let errors = [];
    
    if (openBraces !== closeBraces) {
      hasError = true;
      errors.push(`Braces mismatch: ${openBraces} open, ${closeBraces} close`);
    }
    
    if (openParens !== closeParens) {
      hasError = true;
      errors.push(`Parens mismatch: ${openParens} open, ${closeParens} close`);
    }
    
    // Check for common JSX syntax issues
    if (content.includes('><') && !content.includes('</>')) {
      // Look for adjacent JSX elements
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('><') && !lines[i].includes('</>') && !lines[i].includes('React.Fragment')) {
          hasError = true;
          errors.push(`Adjacent JSX elements at line ${i + 1}`);
          break;
        }
      }
    }
    
    // Check for unclosed JSX tags
    const selfClosingTags = content.match(/<[^>]*\/>/g) || [];
    const estimatedOpenTags = openTags - selfClosingTags.length;
    
    if (Math.abs(estimatedOpenTags - closeTags) > 5) { // Allow some tolerance
      hasError = true;
      errors.push(`Possible JSX tag imbalance`);
    }
    
    if (hasError) {
      errorFiles.push({ file: filePath, errors });
      console.log(`❌ ${filePath}`);
      errors.forEach(error => console.log(`   - ${error}`));
    } else {
      console.log(`✅ ${filePath}`);
    }
    
  } catch (error) {
    errorFiles.push({ file: filePath, errors: [`Read error: ${error.message}`] });
    console.log(`❌ ${filePath} - Read error: ${error.message}`);
  }
});

console.log(`\n📊 Summary:`);
console.log(`Total files checked: ${totalFiles}`);
console.log(`Files with errors: ${errorFiles.length}`);
console.log(`Files OK: ${totalFiles - errorFiles.length}`);

if (errorFiles.length > 0) {
  console.log(`\n🚨 Files with syntax errors:`);
  errorFiles.forEach(file => {
    console.log(`\n${file.file}:`);
    file.errors.forEach(error => console.log(`  - ${error}`));
  });
} else {
  console.log(`\n✅ All files appear syntactically correct!`);
}
