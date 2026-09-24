/**
 * Explain the comparison risk score column of a group overview table.
 *
 * Each comparison score gets a badge showing how far it is below the site risk
 * score, and clicking a comparison score lists the KRIs whose weight was
 * reduced in a row directly under that group. Does nothing unless the comparison
 * column is displayed and per-KRI detail was supplied.
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
        if (result.MetricID !== input.strSiteRiskMetric && result.MetricID !== comparisonMetric) return;
        const group = (scores[result.GroupID] = scores[result.GroupID] || {});
        if (result.MetricID === input.strSiteRiskMetric) group.site = parseFloat(result.Score);
        if (result.MetricID === comparisonMetric) {
            group.comparison = parseFloat(result.Score);
            group.denominator = parseFloat(result.Denominator);
        }
    });

    const metricLabels = {};
    (input.dfMetrics || []).forEach((metric) => {
        metricLabels[metric.MetricID] = metric.Abbreviation || metric.Metric || metric.MetricID;
    });

    const detailByGroup = {};
    detail.forEach((row) => {
        (detailByGroup[row.GroupID] = detailByGroup[row.GroupID] || []).push(row);
    });

    const scoreDrop = (groupID) => {
        const group = scores[groupID];
        if (!group || isNaN(group.site) || isNaN(group.comparison)) return 0;
        return Math.round(group.site) - Math.round(group.comparison);
    };

    let selectedGroup = null;

    const buildPanel = () => {
        const panel = document.createElement('div');
        panel.style.cssText = 'padding: 4px 8px 8px; font-size: 0.9em; text-align: left;';

        const group = scores[selectedGroup] || {};
        const rows = (detailByGroup[selectedGroup] || [])
            .filter((row) => parseFloat(row.Weight) !== 0)
            .map((row) => ({
                ...row,
                reduction: parseFloat(row.Weight) - parseFloat(row.EffectiveWeight)
            }))
            .sort((a, b) => b.reduction - a.reduction || parseFloat(b.Weight) - parseFloat(a.Weight));

        const heading = document.createElement('div');
        heading.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        heading.textContent = `${input.strComparisonRiskLabel} for ${selectedGroup}: ` +
            `${Math.round(group.comparison)} (site risk score ${Math.round(group.site)})`;
        panel.appendChild(heading);

        // A grid of divs rather than a nested table: the group overview selects
        // every <tr> under its tbody, and nested rows would break its redraw.
        const grid = document.createElement('div');
        grid.className = 'group-overview--comparison-detail-grid';
        grid.style.cssText =
            'display: inline-grid; grid-template-columns: repeat(6, auto); column-gap: 16px; row-gap: 2px;';
        const addCell = (value, style) => {
            const cell = document.createElement('div');
            cell.textContent = value;
            cell.style.cssText = style || '';
            grid.appendChild(cell);
        };
        ['KRI', 'Flag', 'Weight', 'Action state', 'ActionLog date', 'Effect']
            .forEach((label) => addCell(label, 'font-weight: bold;'));

        rows.forEach((row) => {
            const reduced = row.reduction > 0;
            const effect = reduced && group.denominator > 0
                ? `−${(row.reduction / group.denominator * 100).toFixed(1)}`
                : 'kept';
            [
                metricLabels[row.MetricID] || row.MetricID,
                isMissing(row.Flag) ? '-' : row.Flag,
                row.Weight,
                isMissing(row.ActionState) ? 'Missing' : row.ActionState,
                isMissing(row.ActionSnapshotDate) ? '-' : row.ActionSnapshotDate,
                effect
            ].forEach((value) => {
                addCell(value, reduced ? 'color: #c8102e;' : '');
            });
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
        detailCell.style.cssText = 'background: #f7f7f7; border-left: 2px solid #e8a8b4;';
        detailCell.appendChild(buildPanel());
        groupRow.after(detailRow);
    };

    // The group overview redraws its cells on sort and subset changes, which
    // removes the badges, so they are re-applied whenever the table changes.
    const applyBadges = () => {
        el.querySelectorAll('td.group-overview--comparisonRiskScore').forEach((cell) => {
            const datum = cell.__data__;
            if (!datum || !detailByGroup[datum.GroupID]) return;
            cell.style.cursor = 'pointer';
            cell.title = 'Show the KRIs behind this score';
            const drop = scoreDrop(datum.GroupID);
            if (drop > 0 && !cell.querySelector('.group-overview--comparison-delta')) {
                const badge = document.createElement('span');
                badge.className = 'group-overview--comparison-delta';
                badge.textContent = `−${drop}`;
                badge.style.cssText =
                    'margin-left: 4px; font-size: 0.8em; color: #c8102e; text-shadow: none;';
                cell.appendChild(badge);
            }
        });
    };

    const refresh = (rebuildDetail) => {
        observer.disconnect();
        applyBadges();
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
