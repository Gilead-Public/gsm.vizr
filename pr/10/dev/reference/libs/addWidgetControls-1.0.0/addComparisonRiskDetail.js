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
    const comparisonResults = {};
    input.dfResults.forEach((result) => {
        if (result.MetricID === comparisonMetric) {
            scores[result.GroupID] = parseFloat(result.Score);
            comparisonResults[result.GroupID] = result;
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

    const datedDetail = detail.find((row) => !isMissing(row.ActionWindowDays));
    const dateWindowMode = datedDetail !== undefined;
    const windowDays = 90;
    let selectedGroup = null;
    let controls = null;
    let tableScroll = null;
    const isRecent = (row) => dateWindowMode && !isMissing(row.LastActionedDate) &&
        !isMissing(row.DaysSinceAction) &&
        Number.isFinite(Number(row.DaysSinceAction)) &&
        Number(row.DaysSinceAction) >= 0 && Number(row.DaysSinceAction) <= windowDays;
    const actionReason = (row) => dateWindowMode
        ? row.ActionReason || row.ActionCoverageReason || row.ActionRecency || 'Unknown'
        : row.ActionState;

    const buildPanel = () => {
        const panel = document.createElement('div');
        panel.style.cssText = 'padding: 4px 8px 8px; font-size: 0.9em; text-align: left; overflow-x: auto;';

        const rows = (detailByGroup[selectedGroup] || [])
            .filter((row) => dateWindowMode || parseFloat(row.Weight) !== 0)
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
        grid.setAttribute('role', 'table');
        const headers = dateWindowMode
            ? ['KRI', 'Flag', 'Action state', 'Last addressed', 'Days ago', 'Review status', 'Counted', 'Source IDs']
            : ['KRI', 'Flag', 'Action state', 'Signal snapshot', 'Counted'];
        grid.style.cssText =
            `display: inline-grid; grid-template-columns: repeat(${headers.length}, max-content); column-gap: 20px; row-gap: 3px;`;
        const addCell = (parent, content, header = false) => {
            const cell = document.createElement('div');
            cell.textContent = content;
            cell.setAttribute('role', header ? 'columnheader' : 'cell');
            if (header) cell.style.cssText = 'font-weight: bold; border-bottom: 1px solid #ccc;';
            parent.appendChild(cell);
        };
        headers.forEach((label) => addCell(grid, label, true));

        rows.forEach((row) => {
            const weight = isMissing(row.Weight) ? NaN : Number(row.Weight);
            const effective = Number(row.EffectiveWeight);
            const counted = !Number.isFinite(weight) ? 'Not weighted' :
                effective <= 0 ? 'No' : effective < weight ? 'Partly' : 'Yes';
            const line = document.createElement('div');
            line.setAttribute('role', 'row');
            line.dataset.metricId = row.MetricID;
            line.style.display = 'contents';
            if (!dateWindowMode && counted === 'No') line.style.color = '#666';
            const values = [
                metricLabels[row.MetricID] || row.MetricID,
                isMissing(row.Flag) ? '-' : row.Flag,
                isMissing(row.ActionState) ? 'Missing' : row.ActionState,
                ...(dateWindowMode ? [
                    isMissing(row.LastActionedDate) ? '-' : row.LastActionedDate,
                    isMissing(row.DaysSinceAction) ? '-' : row.DaysSinceAction,
                    actionReason(row)
                ] : [isMissing(row.ActionSnapshotDate) ? '-' : row.ActionSnapshotDate]),
                counted
            ];
            if (dateWindowMode) values.push([row.ActionRiskSignalID, row.ActionID].filter((value) => !isMissing(value)).join(' / ') || '-');
            values.forEach((value) => addCell(line, value));
            line.title = dateWindowMode
                ? `As of: ${row.ActionAsOfDate}; extraction: ${row.ActionExtractionDate || '-'}; source: ${row.ActionedDateSource || '-'}`
                : '';
            grid.appendChild(line);
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
            cell.tabIndex = 0;
            cell.setAttribute('role', 'button');
            cell.setAttribute('aria-expanded', String(selectedGroup === datum.GroupID));
        });
        if (!dateWindowMode) return;
        el.querySelectorAll('td.group-overview--metric').forEach((cell) => {
            const datum = cell.__data__;
            const row = datum && (detailByGroup[datum.GroupID] || []).find((item) => item.MetricID === datum.MetricID);
            const recent = row && isRecent(row);
            cell.classList.toggle('group-overview--recent-action', Boolean(recent));
            cell.style.boxShadow = recent ? 'inset 0 0 0 2px #2563eb' : '';
            if (row) {
                const recency = recent
                    ? `Action recorded within 90 days: ${row.LastActionedDate} (${row.DaysSinceAction} days before ${row.ActionAsOfDate || 'assessment'}).`
                    : `Last addressed: ${isMissing(row.LastActionedDate) ? '-' : row.LastActionedDate}.`;
                cell.title = `${datum.tooltipContent || ''}\n${recency} ${actionReason(row)}`;
                cell.setAttribute('aria-description', `${recency} ${actionReason(row)}`);
            }
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

    const toggleDetail = (event) => {
        const cell = event.target.closest('td.group-overview--comparisonRiskScore');
        if (!cell || !cell.__data__ || !detailByGroup[cell.__data__.GroupID]) return;
        const groupID = cell.__data__.GroupID;
        selectedGroup = selectedGroup === groupID ? null : groupID;
        refresh(true);
    };
    const keyboardDetail = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (!event.target.matches('td.group-overview--comparisonRiskScore')) return;
        event.preventDefault();
        toggleDetail(event);
    };
    const beforeSort = (event) => {
        if (!event.target.closest('th')) return;
        observer.disconnect();
        el.querySelectorAll('tr.group-overview--comparison-detail').forEach((row) => row.remove());
        requestAnimationFrame(() => refresh(true));
    };
    el.addEventListener('click', toggleDetail);
    el.addEventListener('keydown', keyboardDetail);
    el.addEventListener('click', beforeSort, true);

    if (dateWindowMode) {
        controls = document.createElement('div');
        controls.className = 'group-overview--action-controls';
        controls.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 0;';
        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.textContent = 'Download review data';
        downloadButton.title = 'Download action evidence and reported risk scores as JSON';
        downloadButton.addEventListener('click', () => {
            const visible = new Set([...el.querySelectorAll('td.group-overview--comparisonRiskScore')]
                .map((cell) => cell.__data__.GroupID));
            const payload = {
                settings: {
                    actionWindowDays: datedDetail.ActionWindowDays,
                    highlightWindowDays: windowDays,
                    actionAsOfDate: datedDetail.ActionAsOfDate
                },
                groups: Object.entries(comparisonResults)
                    .filter(([groupID]) => visible.has(groupID))
                    .map(([groupID, result]) => {
                        const original = input.dfResults.find((row) => row.GroupID === groupID &&
                            row.MetricID === (input.strSiteRiskMetric || 'Analysis_srs0001'));
                        return {
                            GroupID: groupID,
                            OriginalRiskScore: original ? Number(original.Score) : null,
                            ReportedPriorityScore: Number(result.Score),
                            ReviewPriorityScore: scores[groupID],
                            Numerator: Number(result.Numerator),
                            Denominator: Number(result.Denominator),
                            KRIs: (detailByGroup[groupID] || []).map((row) => ({
                                ...row,
                                RecentAction: isRecent(row),
                                ActionReason: actionReason(row)
                            }))
                        };
                    })
            };
            const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'review-priority.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        });
        controls.appendChild(downloadButton);
        const table = el.querySelector('table.group-overview');
        tableScroll = document.createElement('div');
        tableScroll.className = 'group-overview--comparison-scroll';
        tableScroll.style.cssText = 'max-width: 100%; overflow-x: auto;';
        tableScroll.tabIndex = 0;
        tableScroll.setAttribute('role', 'region');
        tableScroll.setAttribute('aria-label', 'Site risk and review priority scores');
        table.before(tableScroll);
        tableScroll.appendChild(table);
        el.insertBefore(controls, tableScroll);
    }
    return () => {
        observer.disconnect();
        el.removeEventListener('click', toggleDetail);
        el.removeEventListener('keydown', keyboardDetail);
        el.removeEventListener('click', beforeSort, true);
        if (controls) controls.remove();
        if (tableScroll) tableScroll.replaceWith(...tableScroll.childNodes);
    };
};
