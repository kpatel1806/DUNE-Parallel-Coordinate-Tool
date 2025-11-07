"use strict";

// 1. Your new Web App URL is already here.
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzhHQJeMyt3pINWpXcDr4wEm4tAlxzsNPG_KxAnik7MT8hW80qoEPs2GyhZV6jz29Fw/exec";

// We declare DATA here so all functions can access it
let DATA;
// Define which columns to summarize
const SUMMARY_COLUMNS = [
  "EUI (Total) (kWh/mｲ)",
  "EUI (Electricity) (kWh/mｲ)",
  "EUI (Gas) (kWh/mｲ)"
];

// This function will fetch the data and then build the chart
window.onload = async (event) => {
  try {
    // 1. Fetch the data from your Apps Script
    const response = await fetch(GAS_WEB_APP_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();

    // 2. Parse the CSV text just like the original script did
    DATA = d3.csvParse(csvText, d3.autoType);

    // 3. Run the original setup code *after* data is loaded
    initMultiselect();

    // --- INNOVATION: Dynamic Columns ---
    const DEFAULT_COLS = Object.keys(DATA[0]);
    const DEFAULT_COLOR = DEFAULT_COLS.includes("Permutation #") ? "Permutation #" : DEFAULT_COLS[0];
    // --- END INNOVATION ---

    var data = columnsToShow(DATA, DEFAULT_COLS);
    createMultiSelectOptions(DATA, DEFAULT_COLS);
    createColorColumnOptions(DATA);

    // Set the default color in the dropdown
    colorOnColumn = DEFAULT_COLOR;
    let colorOptions = document.getElementById("colorselect");
    let defaultColorIndex = DEFAULT_COLS.indexOf(DEFAULT_COLOR);
    colorOptions.selectedIndex = defaultColorIndex !== -1 ? defaultColorIndex : 0;

    createPlotAndGrid(data);

    // --- NEW: Update summary with initial full dataset ---
    updateSummary(data);

  } catch (error) {
    // Show an error if the data can't be loaded
    console.error("Error loading or parsing data:", error);
    // Also style the error message to fit the new header
    const errorHTML = `
      <h2 style="color: red; margin: 24px;">Error Loading Data</h2>
      <p style="margin: 24px;">Could not load data from Google Apps Script.
      <br><br>
      Please check:
      <ul>
        <li>The URL in <code>multiselect.js</code> is correct.</li>
        <li>The Apps Script is deployed (you may need to re-deploy as a new version if you made changes).</li>
        <li>The Sheet ID and Sheet Name in <code>Code.gs</code> are correct.</li>
        <li>The <code>Code.gs</code> file includes the <code>.addHeader("Access-Control-Allow-Origin", "*")</code> lines.</li>
      </ul>
      </p>`;
    // Add the error message *after* the header
    document.body.insertAdjacentHTML('beforeend', errorHTML);
  }
};


// --- NEW FUNCTION: "Set as Baseline" ---
function clearBaseline() {
  parcoords.unmark();
  parcoords.renderMarked();
}

// --- NEW FUNCTION: "Dynamic Statistical Summary" ---
function updateSummary(data) {
  const summaryContent = document.getElementById("summary-content");

  if (!data || data.length === 0) {
    summaryContent.innerHTML = "<p>No data to summarize.</p>";
    return;
  }

  let html = "";

  // Add a count of the filtered rows
  html += `
    <div class="summary-stat">
      <p class="summary-stat-label">Filtered Count</p>
      <p class="summary-stat-value">${data.length} / ${DATA.length}</p>
    </div>
  `;

  // Generate stats for each key column
  SUMMARY_COLUMNS.forEach(colName => {
    if (DATA[0].hasOwnProperty(colName)) {
      const allValues = data.map(d => d[colName]).filter(v => v !== null && v !== undefined);
      if (allValues.length > 0) {
        const min = d3.min(allValues);
        const max = d3.max(allValues);
        const mean = d3.mean(allValues);

        // Shorten label for display
        const shortLabel = colName.split('(')[0].trim();

        html += `
          <div class="summary-stat">
            <p class="summary-stat-label">${shortLabel}</p>
            <p class="summary-stat-value">${mean.toFixed(2)}</p>
            <p class="summary-stat-value small">(Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)})</p>
          </div>
        `;
      }
    }
  });

  summaryContent.innerHTML = html;
}


// --- NEW FUNCTION ---
function downloadFilteredData() {
  /* exports the BRUSHED (filtered) CSV data as a file */

  let filteredData = parcoords.brushed();

  if (!filteredData || filteredData.length === 0) {
    const gridData = parcoords.grid.getData().getItems();
    if (gridData.length === DATA.length) {
      alert("No filters are active. Please filter the data by dragging on an axis first.");
      return;
    }
    filteredData = gridData;
  }

  if (filteredData.length === 0) {
     alert("No data selected. Please filter the data by dragging on an axis first.");
     return;
  }

  let lookup = makeTruncatedLookup(DATA);
  let untrun = untruncateData(filteredData, lookup);

  const csvString = d3.csvFormat(untrun);

  const element = document.createElement("a");
  element.setAttribute(
    "href",
    (
      "data:text/plain;charset=utf-8,"
      + '\ufeff' // UTF-8 BOM
      + encodeURIComponent(csvString)
    )
  );
  element.setAttribute("download", "dune_filtered_data.csv");

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}


// --- ORIGINAL FUNCTIONS (with fixes and new features) ---

function downloadAllData() {
  /* exports the CSV data as a file */
  const csvString = d3.csvFormat(DATA);

  const element = document.createElement("a");
  element.setAttribute(
    "href",
    (
      "data:text/plain;charset=utf-8,"
      + '\ufeff' // UTF-8 BOM
      + encodeURIComponent(csvString)
    )
  );
  element.setAttribute("download", "dune_all_data.csv");

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function initMultiselect() {
  /* ensures the dropdown engages when clicked */
  checkboxStatusChange();

  document.addEventListener("click", function (event) {
    const flyoutElement = document.getElementById("dropdown");
    let targetElement = event.target; // clicked element

    do {
      if (targetElement == flyoutElement) {
        // short circuit, ignore clicking inside
        return;
      }

      targetElement = targetElement.parentNode;
    } while (targetElement);

    toggleCheckboxArea(true);
  });
}

let checkboxValues;

function checkboxStatusChange() {
  /* updates which columns are selected on each click,
     and changes the preview on the dropdown text */
  const multiselect = document.getElementById("selectLabel");
  const multiselectOption = multiselect.getElementsByTagName("option")[0];

  const values = [];
  const checkboxes = document.getElementById("selectOptions");
  const checkedCheckboxes = checkboxes.querySelectorAll(
    "input[type=checkbox]:checked"
  );

  for (const item of checkedCheckboxes) {
    let checkboxValue = item.getAttribute("value");
    values.push(checkboxValue);
  }

  let dropdownValue = "Select Columns";
  if (values.length === 0) {
    dropdownValue = "Nothing is selected";
  } else if (values.length === Object.keys(DATA[0]).length) {
    dropdownValue = "All columns selected";
  }
  else if (values.length > 0) {
    let count = values.length;
    let colText = count == 1 ? "column" : "columns";
    dropdownValue = count + " " + colText + " selected";
  }

  multiselectOption.innerText = dropdownValue;
  checkboxValues = values;
}

function createMultiSelectOptions(data, defaults) {
  /* populates the selectBox with all column values */
  if (!data || data.length === 0) return; // Guard against empty data
  let firstRow = data[0];
  let options = document.getElementById("selectOptions");
  options.innerHTML = "";

  let cols = Object.keys(firstRow);
  for (let col of cols) {
    let label = document.createElement("label");
    label.setAttribute("for", col);

    let input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.setAttribute("id", col);
    input.setAttribute("onchange", "checkboxStatusChange()");
    input.setAttribute("value", col);
    if (defaults.indexOf(col) !== -1) {
      input.setAttribute("checked", true);
    }

    label.appendChild(input);
    label.innerHTML += " " + col;

    options.appendChild(label);
  }

  checkboxStatusChange();
}

function createColorColumnOptions(data) {
  /* populates the dropdown with all column values */
  if (!data || data.length === 0) return; // Guard against empty data
  let firstRow = data[0];
  let colorOptions = document.getElementById("colorselect");
  colorOptions.innerHTML = ""; // Clear existing options

  let cols = Object.keys(firstRow);

  for (let col of cols) {
    let option = document.createElement("option");
    option.setAttribute("value", col);
    option.innerHTML = col;

    colorOptions.appendChild(option);
  }
}

function changeColorColumn() {
  /* gets the value from the dropdown, and redraws */
  if (!DATA || DATA.length === 0) return; // Guard
  let colorOptions = document.getElementById("colorselect");
  colorOnColumn = Object.keys(DATA[0])[colorOptions.selectedIndex];
  let data = columnsToShow(DATA, checkboxValues);
  createPlotAndGrid(data);
}

function toggleCheckboxArea(onlyHide = false) {
  /* this pings whenever the selectBox
     is clicked or unclicked. onlyHide prevents
     it from being shown when we don't want it to be */
  const checkboxes = document.getElementById("selectOptions");
  const displayValue = checkboxes.style.display;

  if (displayValue != "block") {
    if (onlyHide == false) {
      checkboxes.style.display = "block";
    }
  } else {
    checkboxes.style.display = "none";
    // redraw entire plot
    if (!DATA) return; // Guard
    const data = columnsToShow(DATA, checkboxValues);
    createPlotAndGrid(data);
  }
}

let parcoords;
let colorOnColumn; // Will be set in window.onload

function getAllValues(data, columnName) {
  /* should be used for string valued items,
     i.e. categories.

     this returns a unique, sorted list
     of all the possible values for that column */
  let vals = new Set();

  for (let row in data) {
    vals.add(data[row][columnName]);
  }

  return Array.from(vals).sort();
}

function interpolateToScheme(interpolate, n) {
  /* since we can't use interpolates with scaleOrdinal,
     it needs to be converted to a scheme with n items */
  let result = [];

  let color = d3.scaleSequential(interpolate).domain([1, n]);
  for (let i = 1; i <= n; i++) {
    result.push(color(i));
  }

  return result;
}

function findFirstUnusedTruncatedString(values, string) {
  /* finds the first equivalent truncated string in the values array */
  let newStr = string;
  let n = 2;
  while (values.indexOf(newStr) !== -1) {
    newStr = string + " " + n;
    n++;
  }
  return newStr;
}

function makeTruncatedLookup(data) {
  /* for each key in data, this gathers all the
  range of values, and the equivalent lookup
  (if a truncation is necessary) */
  if (!data || data.length === 0) return {}; // Guard
  let keys = Object.keys(data[0]);
  let lookup = {};
  const TEXTLENGTH = 20;

  for (let key of keys) {
    for (let row of data) {
      if (!lookup[key]) lookup[key] = {};
      let val = row[key];
      if (val in lookup[key]) continue;
      if (typeof val == "string" && val != " " && val.length > TEXTLENGTH) {
        let values = Object.keys(lookup[key]).map(function(k){
          return lookup[key][k];
        });
        lookup[key][val] = findFirstUnusedTruncatedString(values, val.substring(0, TEXTLENGTH) + "...");
      } else {
        lookup[key][val] = val;
      }
    }
  }

  return lookup;
}

function truncateData(data) {
  /* truncates the entire data array */
  let newdata = [];
  let lookup = makeTruncatedLookup(data);
  if (Object.keys(lookup).length === 0) return data; // No data, no lookup

  for (let row of data) {
    let newvals = {};
    for (let k of Object.keys(row)) {
      newvals[k] = lookup[k][row[k]];
    }
    newdata.push(newvals);
  }
  return newdata;
}

function invertLookup(obj) {
  /* inverts a lookup. here, this is used to take
  a truncation mapping and use it to un-truncate.

  {'a': {'b': 'c'}} -> {'a': {'c': 'b'}} */
  var ret = {};
  for (var key in obj) {
    let newvals = {};
    for (var el in obj[key]) {
      newvals[obj[key][el]] = el;
    }
    ret[key] = newvals;
  }
  return ret;
}

function untruncateData(truncatedData, lookup) {
  /* given truncated data and a lookup, untruncates the data.

  this is used for the sake of slickgrid, so it shows untruncated
  data even after filtering. */
  let invLookup = invertLookup(lookup);
  let newdata = [];
  if (Object.keys(invLookup).length === 0) return truncatedData; // No lookup, return original

  for (let row of truncatedData) {
    let newvals = {};
    for (let k of Object.keys(row)) {
      // Handle potential missing keys in lookup
      if (invLookup[k] && invLookup[k][row[k]] !== undefined) {
         newvals[k] = invLookup[k][row[k]];
      } else {
         newvals[k] = row[k];
      }
    }
    // id needs to be special cased as an int here for slickgrid.
    if (newvals["id"]) {
      newvals["id"] = parseInt(newvals["id"]);
    }
    newdata.push(newvals);
  }
  return newdata;
}

function createPlotAndGrid(data) {
  if (parcoords) {
    parcoords = null;
    document.getElementById("parcoords").innerHTML = "";
  }
  if (!data || data.length === 0) {
      document.getElementById("parcoords").innerHTML = "<p style='margin:24px;'>No data to display. Check filters.</p>";
      // Still create an empty grid
      var grid = new Slick.Grid("#grid", [], [], {});
      updateSummary([]); // Show empty summary
      return;
  }

  // --- MODIFICATION ---
  // Calculate height of the chart dynamically.
  // 60px for header, 330px for grid/controls area
 // --- NEW: Read height from the CSS-styled container ---
const container = document.getElementById("parcoords");
const chartHeight = container.clientHeight;
// --- End New ---

  parcoords = ParCoords()("#parcoords")
  .alpha(0.4)
  .mode("queue") // progressive rendering
  .height(chartHeight) // Use the new dynamic height
  .margin({
    top: 70,  // <--- This is the top margin you wanted
    left: 65,
    right: 88,
    bottom: 80,
  });

  let colExtent, colColor;

  function setColorFunc() {
    /* columns with numbers in a range can use a scaleSequential,
       but those that have categorical string values need to use a
       scaleOrdinal. this allows for fairly rudimentary checking of that */

    // Guard against empty data or missing column
    if (!data[0] || !data[0].hasOwnProperty(colorOnColumn)) {
        colColor = d3.scaleSequential(d3.interpolateTurbo).domain([0,1]);
        return;
    }

    if (typeof data[0][colorOnColumn] == "number") {
      colExtent = d3.extent(data, function (p) {
        return +p[colorOnColumn];
      });
      colColor = d3.scaleSequential(d3.interpolateTurbo).domain(colExtent);
    } else if (typeof data[0][colorOnColumn] == "string") {
      colExtent = getAllValues(data, colorOnColumn);
      let scheme = interpolateToScheme(d3.interpolateTurbo, colExtent.length);
      colColor = d3.scaleOrdinal().domain(colExtent).range(scheme);
    } else {
      // fallback
      colColor = d3.scaleSequential(d3.interpolateTurbo).domain([0,1]);
    }
  }

  setColorFunc();

  function colorFunc(rowData) {
    return colColor(rowData[colorOnColumn]);
  }

  // truncate the data here, so it's truncated on the plot,
  // but not in the grid
  let trunData = truncateData(data);

  // This is the NEW, FIXED code
parcoords
  .data(trunData)
  .hideAxis(["name"])
  .color(colorFunc)
  .render()
  .brushMode("1D-axes-multi")
  .reorderable(); // <-- ADD THIS LINE

  // slickgrid needs each data element to have an id.
  // we do this after initializing the parcoords so the id
  // column doesn't show up in the plot itself
  data.forEach(function (d, i) {
    d.id = d.id || i;
  });

  trunData.forEach(function (d, i) {
    d.id = d.id || i;
  });

  parcoords.svg
    .selectAll(".dimension")
    .style("font-weight", "normal")
    .filter(function (d) {
      return d == colorOnColumn;
    })
    .style("font-weight", "bold");

  var column_keys = Object.keys(data[0]);
  var columns = column_keys.map(function (key, i) {
    return {
      id: key,
      name: key,
      field: key,
      sortable: true,
    };
  });

  var options = {
    enableCellNavigation: true,
    enableColumnReorder: false,
    multiColumnSort: false,
  };

  var dataView = new Slick.Data.DataView();
  var grid = new Slick.Grid("#grid", dataView, columns, options);
  var pager = new Slick.Controls.Pager(dataView, grid, $("#pager"));

  // Store grid on parcoords for access by downloadFilteredData
  parcoords.grid = grid;
  // Store full untruncated data for filtered download
  parcoords.data = data;

  // wire up model events to drive the grid
  dataView.onRowCountChanged.subscribe(function (e, args) {
    grid.updateRowCount();
    grid.render();
  });

  dataView.onRowsChanged.subscribe(function (e, args) {
    grid.invalidateRows(args.rows);
    grid.render();
  });

  // column sorting
  var sortcol = column_keys[0];

  function comparer(a, b) {
    var x = a[sortcol],
      y = b[sortcol];
    return x == y ? 0 : x > y ? 1 : -1;
  }

  // click header to sort grid column
  grid.onSort.subscribe(function (e, args) {
    sortcol = args.sortCol.field;
    dataView.sort(comparer, args.sortAsc);
  });

  // --- MODIFIED: Changed to onDblClick for "Set as Baseline" ---
  grid.onDblClick.subscribe(function (e, args) {
    // Get row number from grid
    const grid_row = args.row;
    if (grid_row === undefined) return;

    // Get the item
    const item = grid.getDataItem(grid_row);
    if (!item) return;

    // Find the full, untruncated data row from our original data
    // This is safer than using the (potentially truncated) trunData
    const dataRow = parcoords.data.find(row => row.id === item.id);
    if (!dataRow) return;

    // Mark this row as the new baseline
    parcoords.unmark(); // Clear previous baseline
    parcoords.mark([dataRow]); // Mark the new one
    parcoords.renderMarked();
  });

  // highlight row in chart
  grid.onMouseEnter.subscribe(function (e, args) {
    // Get row number from grid
    const grid_row = grid.getCellFromEvent(e).row;

    if (grid_row === undefined) return;

    const item = grid.getDataItem(grid_row);
    if (!item) return;
    const item_id = item.id;

    const d = parcoords.brushed() || trunData;

    let lookup = makeTruncatedLookup(data);
    let untrun = untruncateData(d, lookup);

    const elementPos = d
      .map(function (x) {
        return x.id;
      })
      .indexOf(item_id);

    if (elementPos > -1) {
      parcoords.highlight([d[elementPos]]);
    }
  });

  grid.onMouseLeave.subscribe(function (e, args) {
    parcoords.unhighlight();
  });

  // fill grid with data
  gridUpdate(data);

  // update grid on brush
  parcoords.on("brush", function (d) {
    let lookup = makeTruncatedLookup(parcoords.data);
    let untrun = untruncateData(d, lookup);
    gridUpdate(untrun);

    // --- NEW: Update summary panel on brush ---
    updateSummary(untrun);
  });

  function gridUpdate(data) {
    dataView.beginUpdate();
    dataView.setItems(data);
    dataView.endUpdate();
  }
}

// *** This variable is no longer used, we get columns from the data directly ***
// var columnsText = `...`;

function columnsToShow(data, columns) {
  /* filters the data array of objs
     based on the column names in columns */
  let results = [];
  if (!data) return results; // Guard against null data

  // Find the columns that *actually exist* in the data
  const dataColumns = Object.keys(data[0]);
  const validColumns = columns.filter(col => dataColumns.includes(col));

  for (let el of data) {
    let newobj = {};
    // Only loop over columns that are valid
    for (let key of validColumns) {
      newobj[key] = el[key];
    }
    results.push(newobj);
  }

  results = results.filter(function(d) {
    // Check if 'Permutation #' exists before filtering on it
    return d.hasOwnProperty('Permutation #') ? d['Permutation #'] !== 0 : true;
  });

  return results;
}

function resetToDefault() {
  /* gets the updated columns to show, and redraws */

  // --- INNOVATION ---
  // Default columns are now *all* columns from the original data
  const DEFAULT_COLS = Object.keys(DATA[0]);
  const DEFAULT_COLOR = DEFAULT_COLS.includes("Permutation #") ? "Permutation #" : DEFAULT_COLS[0];
  // --- END INNOVATION ---

  let data = columnsToShow(DATA, DEFAULT_COLS);

  createMultiSelectOptions(DATA, DEFAULT_COLS);

  colorOnColumn = DEFAULT_COLOR;
  let colorOptions = document.getElementById("colorselect");

  // Find the index of the default color, or default to 0
  let defaultColorIndex = DEFAULT_COLS.indexOf(DEFAULT_COLOR);
  colorOptions.selectedIndex = defaultColorIndex !== -1 ? defaultColorIndex : 0;

  createPlotAndGrid(data);

  // --- NEW: Update summary on reset ---
  updateSummary(data);
}
