# Dune - Interactive Retail Results Dashboard
This is an interactive parallel coordinates chart for analyzing building performance data from the "Retail Results" Google Sheet. It's designed to help teams at Dune Engineering visually filter and compare different design permutations.

## ✨ Features
* **Live Data:** Pulls data directly from a private Google Sheet using a secure Google Apps Script.
* **Fully Interactive:** Filter data in real-time by clicking and dragging on any axis.
* **Re-orderable Axes:** Drag and drop axis titles to compare different columns side-by-side.
* **Set as Baseline:** **Double-click** any row in the data grid to mark it with a distinct color (orange) for easy comparison against all other options.
* **Dynamic Summary Panel:** A live-updating dashboard panel that shows the filtered row count, as well as the Average, Min, and Max for key EUI columns.
* **Data Export:**
    * **Save All as CSV:** Downloads the complete, original dataset.
    * **Save Filtered as CSV:** Downloads *only* the data that matches your current filters.

## 📖 How to Use the Tool

The interface is divided into three parts: the **Header**, the **Chart Area**, and the **Data Grid**. All controls are in the **Sidebar** on the right.

* **Filter Data:** Click and drag vertically on any axis to create a filter (a "brush").
* **Combine Filters:** You can create filters on multiple axes at the same time to narrow your results.
* **Re-order Axes:** Click and drag an axis title (e.g., "Roof Construction") to move it left or right.
* **Set Baseline:** **Double-click** any row in the data table at the bottom to highlight it in orange. This line will stay highlighted as you adjust other filters.
* **Clear Baseline:** Click the "Clear Baseline" button in the sidebar to remove the highlighted line.
* **Highlight Row:** *Hover* your mouse over any row in the data table to temporarily see its path in blue.
* **Export:** Use the "Save Filtered" button to get a CSV of just the data you've selected.
