/**
 * Explain the second risk score column of a group overview table.
 *
 * Clicking a score in that column opens a row directly under the group listing
 * the KRIs behind it, with their action state and whether each counts toward
 * the score. The score is its own measure, so it is not compared with the site
 * risk score. Does nothing unless the column is displayed and per-KRI detail
 * was supplied.
 *
 * @param {HTMLElement} el - widget element containing the group overview table
 * @param {Object} input - widget input from Widget_GroupOverview()
 *
 * @returns {undefined}
 */
const addComparisonRiskDetail = function (el, input) {
    const detail = input.dfComparisonRiskDetail;
    const comparisonMetric = input.strComparisonRiskMetric;
    if (!Array.isArray(detail) || detail.length === 0 || !comparisonMetric) return;

    const isMissing = (value) =>
        value === null || value === undefined || value === 'NA' || value === '';

    const scores = {};
    input.dfResults.forEach((result) => {
        if (result.MetricID === comparisonMetric) scores[result.GroupID] = parseFloat(result.Score);
    });

    const metricLabels = {};
    (input.dfMetrics || []).forEach((metric) => {
        metricLabels[metric.MetricID] = metric.Abbreviation || metric.Metric || metric.MetricID;
    });

    const detailByGroup = {};
    detail.forEach((row) => {
        (detailByGroup[row.GroupID] = detailByGroup[row.GroupID] || []).push(row);
    });

    let selectedGroup = null;

    const buildPanel = () => {
        const panel = document.createElement('div');
        panel.style.cssText = 'padding: 4px 8px 8px; font-size: 0.9em; text-align: left;';

        const rows = (detailByGroup[selectedGroup] || [])
            .filter((row) => parseFloat(row.Weight) !== 0)
            .sort((a, b) => parseFloat(b.Weight) - parseFloat(a.Weight));

        const heading = document.createElement('div');
        heading.style.cssText = 'font-weight: bold; margin-bottom: 6px;';
        heading.textContent =
            `${selectedGroup}: ${input.strComparisonRiskLabel} ${Math.round(scores[selectedGroup])}`;
        panel.appendChild(heading);

        // A grid of divs rather than a nested table: the group overview selects
        // every <tr> under its tbody, and nested rows would break its redraw.
        const grid = document.createElement('div');
        grid.className = 'group-overview--comparison-detail-grid';
        grid.style.cssText =
            'display: inline-grid; grid-template-columns: repeat(5, auto); column-gap: 20px; row-gap: 3px;';
        const addCell = (content, style) => {
            const cell = document.createElement('div');
            cell.textContent = content;
            cell.style.cssText = style || '';
            grid.appendChild(cell);
        };
        ['KRI', 'Flag', 'Action state', 'ActionLog date', 'Counted']
            .forEach((label) => addCell(label, 'font-weight: bold; border-bottom: 1px solid #ccc;'));

        rows.forEach((row) => {
            const weight = parseFloat(row.Weight);
            const effective = parseFloat(row.EffectiveWeight);
            const counted = effective <= 0 ? 'No' : effective < weight ? 'Partly' : 'Yes';
            [
                metricLabels[row.MetricID] || row.MetricID,
                isMissing(row.Flag) ? '-' : row.Flag,
                isMissing(row.ActionState) ? 'Missing' : row.ActionState,
                isMissing(row.ActionSnapshotDate) ? '-' : row.ActionSnapshotDate,
                counted
            ].forEach((value) => addCell(value, counted === 'No' ? 'color: #777;' : ''));
        });
        panel.appendChild(grid);
        return panel;
    };

    // The breakdown is an extra table row directly under the selected group.
    // The group overview's row join computes a key for every existing row, so
    // the detail row carries a key that matches no group; a redraw then
    // removes it and placeDetailRow() puts it back.
    const placeDetailRow = () => {
        el.querySelectorAll('tr.group-overview--comparison-detail').forEach((row) => row.remove());
        if (selectedGroup === null) return;

        const cell = [...el.querySelectorAll('td.group-overview--comparisonRiskScore')]
            .find((td) => td.__data__ && td.__data__.GroupID === selectedGroup);
        if (!cell) return; // selected group is filtered out of the table

        const groupRow = cell.parentNode;
        const detailRow = document.createElement('tr');
        detailRow.className = 'group-overview--comparison-detail';
        detailRow.__data__ = { key: '__comparison-detail__' };
        const detailCell = detailRow.insertCell();
        detailCell.colSpan = groupRow.cells.length;
        detailCell.style.cssText = 'background: #f7f7f7; border-left: 2px solid #ccc;';
        detailCell.appendChild(buildPanel());
        groupRow.after(detailRow);
    };

    // The group overview redraws its cells on sort and subset changes, so the
    // click affordance is re-applied whenever the table changes.
    const markClickable = () => {
        el.querySelectorAll('td.group-overview--comparisonRiskScore').forEach((cell) => {
            const datum = cell.__data__;
            if (!datum || !detailByGroup[datum.GroupID]) return;
            cell.style.cursor = 'pointer';
            cell.title = 'Click to see the KRIs behind this score.';
        });
    };

    const refresh = (rebuildDetail) => {
        observer.disconnect();
        markClickable();
        const detailRow = el.querySelector('tr.group-overview--comparison-detail');
        const detailPlaced = detailRow &&
            detailRow.previousElementSibling &&
            detailRow.previousElementSibling.querySelector('td.group-overview--comparisonRiskScore') &&
            detailRow.previousElementSibling
                .querySelector('td.group-overview--comparisonRiskScore').__data__.GroupID === selectedGroup;
        if (rebuildDetail || (selectedGroup !== null && !detailPlaced)) placeDetailRow();
        observer.observe(el, { childList: true, subtree: true });
    };
    const observer = new MutationObserver(() => refresh(false));
    refresh(false);

    el.addEventListener('click', (event) => {
        const cell = event.target.closest('td.group-overview--comparisonRiskScore');
        if (!cell || !cell.__data__ || !detailByGroup[cell.__data__.GroupID]) return;
        const groupID = cell.__data__.GroupID;
        selectedGroup = selectedGroup === groupID ? null : groupID;
        refresh(true);
    });
};
