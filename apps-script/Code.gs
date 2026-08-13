/**
 * GEOGLOWS Project Schedule - helper script (installed on "Project Schedule LIVE 3.0")
 * - "Add task in this section": inserts a new task row with the right ID + formulas.
 * - "Clean up formatting": consistent rule-based colors + protects the formula columns.
 *
 * Install: Extensions > Apps Script, paste this, Save, reload the sheet.
 */

var SHEET_NAME = 'Project Schedule';
var COL = { ID:1, LEAD:2, SUPPORT:3, LEVEL:4, NAME:5, DEP:6, FIXED:7, DUR:8, START:9, FINISH:10, PCT:11, STATUS:12, NOTES:13 };

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Schedule Tools')
    .addItem('Add task in this section', 'addTaskInSection')
    .addSeparator()
    .addItem('Clean up formatting', 'formatInputSheet')
    .addToUi();
}

function addTaskInSection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  var ui = SpreadsheetApp.getUi();
  if (ss.getActiveSheet().getName() !== SHEET_NAME) {
    ui.alert('Switch to the "' + SHEET_NAME + '" tab, click any row inside a lead section, then run this again.');
    return;
  }
  var lastRow = sh.getLastRow();
  var row = sh.getActiveCell().getRow();
  if (row < 2) row = 2;

  var levels = sh.getRange(2, COL.LEVEL, lastRow - 1, 1).getValues();
  var ids    = sh.getRange(2, COL.ID,    lastRow - 1, 1).getValues();
  var leads  = sh.getRange(2, COL.LEAD,  lastRow - 1, 1).getValues();
  var levelAt = function (r) { return Number(levels[r - 2][0]) || 0; };

  var headerRow = row;
  while (headerRow >= 2 && levelAt(headerRow) !== 1) headerRow--;
  if (headerRow < 2) {
    ui.alert('Put your cursor inside a lead section (a row at or under a 100 / 200 / ... header), then run again.');
    return;
  }

  var lead   = leads[headerRow - 2][0];
  var baseId = Math.floor(Number(ids[headerRow - 2][0]) / 100) * 100;

  var maxId = baseId;
  for (var i = 0; i < ids.length; i++) {
    var v = Number(ids[i][0]);
    if (v >= baseId && v < baseId + 100 && v > maxId) maxId = v;
  }
  var newId = maxId + 1;

  var activeLevel = levelAt(row);
  var newLevel = (activeLevel >= 2) ? activeLevel : 2;

  sh.insertRowAfter(row);
  var nr = row + 1;

  sh.getRange(nr, COL.ID).setValue(newId);
  sh.getRange(nr, COL.LEAD).setValue(lead);
  sh.getRange(nr, COL.LEVEL).setValue(newLevel);

  sh.getRange(nr, COL.START).setFormula(
    '=IF(G' + nr + '<>"",G' + nr + ',IF(F' + nr + '<>"",IFERROR(INDEX($J$2:$J$2000,MATCH(F' + nr + ',$A$2:$A$2000,0))+1,""),""))'
  );
  sh.getRange(nr, COL.FINISH).setFormula(
    '=IF(I' + nr + '="","",IF(H' + nr + '<>"",I' + nr + '+ROUND(H' + nr + '*7,0)-1,""))'
  );

  sh.getRange(nr, COL.FIXED).setNumberFormat('yyyy-mm-dd');
  sh.getRange(nr, COL.START).setNumberFormat('yyyy-mm-dd');
  sh.getRange(nr, COL.FINISH).setNumberFormat('yyyy-mm-dd');
  sh.getRange(nr, COL.DUR).setNumberFormat('0.0');
  sh.getRange(nr, COL.PCT).setNumberFormat('0%');

  formatInputSheet();
  sh.getRange(nr, COL.NAME).activate();
}

function formatInputSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  var last = sh.getLastRow();
  if (last < 2) return;

  // base look: Arial, normal weight, dark text, clear manual fills, light borders
  var data = sh.getRange(2, 1, last - 1, 13);
  data.setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A1A')
      .setFontWeight('normal').setBackground(null);
  data.setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(2, COL.ID, last - 1, 1).setHorizontalAlignment('center');
  sh.getRange(2, COL.LEVEL, last - 1, 1).setHorizontalAlignment('center');

  // rule-based colors through row 1000 so new rows inherit automatically
  var full = sh.getRange('A2:M1000');
  var sides = [sh.getRange('A2:E1000'), sh.getRange('I2:M1000')];
  var inputs = sh.getRange('F2:H1000');
  var rules = [];

  // input cells (Depends On / Fixed Start / Duration) -> yellow, only on task rows
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR($D2=2,$D2=3)')
    .setBackground('#FFF3C4')
    .setRanges([inputs]).build());

  // Level 1 (lead) -> navy, white, bold, full width
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2=1')
    .setBackground('#002E5D').setFontColor('#FFFFFF').setBold(true)
    .setRanges([full]).build());

  // Level 2 (project) -> light blue, bold (outside the input columns)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2=2')
    .setBackground('#DCE3ED').setBold(true)
    .setRanges(sides).build());

  // Completed sub-task -> green (outside the input columns)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($D2=3,$K2>=1)')
    .setBackground('#E7F2E7')
    .setRanges(sides).build());

  sh.setConditionalFormatRules(rules);

  // keep the computed columns protected; wrapped so a collaborator run never fails
  try { protectComputedColumns(); } catch (e) {}
}

// Warning-only protection on the computed Start/Finish columns:
// catches accidental typing with an "are you sure?" prompt, but the Add-task
// button (a script) can still write the formulas.
function protectComputedColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  var TAG = 'GEOGLOWS computed Start/Finish - do not type here';
  var existing = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getDescription() === TAG) existing[i].remove();
  }
  var p = sh.getRange('I2:J1000').protect().setDescription(TAG);
  p.setWarningOnly(true);
}
