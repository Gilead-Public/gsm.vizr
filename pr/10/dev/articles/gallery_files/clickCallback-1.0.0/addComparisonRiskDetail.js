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
        if (result.MetricID === comparisonMetric) {
            scores[result.GroupID] = parseFloat(result.Score);
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
    let highlightRecentActions = true;
    let selectedGroup = null;
    let controls = null;
    let tableScroll = null;
    const isRecent = (row) => dateWindowMode && !isMissing(row.LastActionedDate) &&
        !isMissing(row.DaysSinceAction) &&
        Number.isFinite(Number(row.DaysSinceAction)) &&
        Number(row.DaysSinceAction) >= 0 && Number(row.DaysSinceAction) <= windowDays;
    const hasRecentFlag = (row) => {
        const hasHistory = Object.prototype.hasOwnProperty.call(row, 'DaysSinceFlag');
        const flag = hasHistory ? row.LastFlaggedFlag : row.Flag;
        const snapshot = hasHistory ? row.LastFlaggedDate : row.SnapshotDate ||
            input.dfResults.find((result) => result.GroupID === row.GroupID && result.MetricID === row.MetricID)?.SnapshotDate;
        const age = hasHistory ? row.DaysSinceFlag :
            (Date.parse(row.ActionAsOfDate || datedDetail?.ActionAsOfDate) - Date.parse(snapshot)) / 86400000;
        return !isMissing(flag) && Number.isFinite(Number(flag)) && Number(flag) !== 0 &&
            !isMissing(age) && Number.isFinite(Number(age)) && Number(age) >= 0 && Number(age) <= windowDays;
    };
    const actionReason = (row) => dateWindowMode
        ? row.ActionReason || row.ActionCoverageReason || row.ActionRecency || 'Unknown'
        : row.ActionState;
    const detailFlag = (row) => dateWindowMode && hasRecentFlag(row) && !isMissing(row.LastFlaggedFlag)
        ? row.LastFlaggedFlag
        : dateWindowMode && isRecent(row) && !isMissing(row.ActionedFlag) ? row.ActionedFlag : row.Flag;
    const actionTimestamp = (row) => {
        const timestamp = isMissing(row.LastActionedDate) ? NaN : Date.parse(row.LastActionedDate);
        return Number.isFinite(timestamp) ? timestamp : -Infinity;
    };
    const flagMagnitude = (row) => {
        const flag = detailFlag(row);
        return !isMissing(flag) && Number.isFinite(Number(flag)) ? Math.abs(Number(flag)) : -Infinity;
    };
    const kriOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    const reviewRows = (rows) => rows
        .map((row) => isMissing(row.Flag) ? {
            ...row,
            Flag: input.dfResults.find((result) =>
                result.GroupID === row.GroupID && result.MetricID === row.MetricID)?.Flag
        } : row)
        .filter((row) => dateWindowMode ? hasRecentFlag(row) || isRecent(row) :
            !isMissing(row.Flag) && Number.isFinite(Number(row.Flag)) && Number(row.Flag) !== 0)
        .sort((left, right) => {
            const leftDate = actionTimestamp(left);
            const rightDate = actionTimestamp(right);
            if (leftDate !== rightDate) return leftDate > rightDate ? -1 : 1;
            const leftSeverity = flagMagnitude(left);
            const rightSeverity = flagMagnitude(right);
            if (leftSeverity !== rightSeverity) return leftSeverity > rightSeverity ? -1 : 1;
            return kriOrder.compare(String(left.MetricID), String(right.MetricID));
        });
    const countedLabel = (row) => {
        const weight = isMissing(row.Weight) ? NaN : Number(row.Weight);
        const effective = Number(row.EffectiveWeight);
        return !Number.isFinite(weight) ? 'Not weighted' :
            effective <= 0 ? 'No' : effective < weight ? 'Partly' : 'Yes';
    };
    const displayedState = (row) => dateWindowMode &&
        (isMissing(row.ActionState) || ['Not flagged', 'Not assessed'].includes(row.ActionState))
        ? 'Not recorded' : row.ActionState;
    const latestActionText = (row) => {
        const state = displayedState(row);
        return `Latest action: ${isMissing(state) ? 'Not recorded' : state}. ` +
            `Last addressed: ${isMissing(row.LastActionedDate) ? '-' : row.LastActionedDate}. ` +
            `Days ago: ${isMissing(row.DaysSinceAction) ? '-' : row.DaysSinceAction}.`;
    };
    const highlightColor = (row) => {
        const state = displayedState(row);
        return state === 'Closed Action' ? '#2e7d32' : state === 'Open Action' ? '#c62828' : '#666666';
    };
    const groupResult = (row, metric) => input.dfResults.find((result) =>
        result.GroupID === row.GroupID && result.MetricID === metric &&
        (isMissing(row.StudyID) || isMissing(result.StudyID) || row.StudyID === result.StudyID));
    const downloadCsv = () => {
        const columns = [
            ['CSVSchemaVersion', () => 1, 'number'],
            ['StudyID', (row) => row.StudyID || groupResult(row, comparisonMetric)?.StudyID],
            ['SnapshotDate', (row) => row.SnapshotDate || groupResult(row, comparisonMetric)?.SnapshotDate || row.ActionAsOfDate, 'date'],
            ['GroupLevel', (row) => row.GroupLevel || input.strGroupLevel || groupResult(row, comparisonMetric)?.GroupLevel],
            ['GroupID', (row) => row.GroupID],
            ['MetricID', (row) => row.MetricID],
            ['MetricLabel', (row) => metricLabels[row.MetricID] || row.MetricID],
            ['CurrentFlag', (row) => row.Flag, 'number'],
            ['ReviewFlag', detailFlag, 'number'],
            ['LastFlaggedDate', (row) => row.LastFlaggedDate, 'date'],
            ['DaysSinceFlag', (row) => row.DaysSinceFlag, 'number'],
            ['ActionState', displayedState],
            ['ActionedFlag', (row) => row.ActionedFlag, 'number'],
            ['LastAddressed', (row) => row.LastActionedDate, 'date'],
            ['DaysAgo', (row) => row.DaysSinceAction, 'number'],
            ['ActionedDateSource', (row) => row.ActionedDateSource],
            ['ActionDateIsProxy', (row) => row.ActionDateIsProxy, 'boolean'],
            ['ActionWindowDays', (row) => row.ActionWindowDays, 'number'],
            ['Weight', (row) => row.Weight, 'number'],
            ['WeightMax', (row) => row.WeightMax, 'number'],
            ['EffectiveWeight', (row) => row.EffectiveWeight, 'number'],
            ['Counted', countedLabel],
            ['ActionFactor', (row) => row.ActionFactor, 'number'],
            ['SnapshotDecisionExcluded', (row) => row.SnapshotDecisionExcluded, 'boolean'],
            ['SnapshotQuarantineBlocked', (row) => row.SnapshotQuarantineBlocked, 'boolean'],
            ['DecisionReason', (row) => row.SnapshotDecisionReason || row.ActionReason || row.ActionCoverageReason],
            ['DecisionCoversFinding', (row) => row.DecisionCoversFinding, 'boolean'],
            ['SiteRiskScore', (row) => groupResult(row, input.strSiteRiskMetric || 'Analysis_srs0001')?.Score, 'number'],
            ['SiteRiskNumerator', (row) => groupResult(row, input.strSiteRiskMetric || 'Analysis_srs0001')?.Numerator, 'number'],
            ['SiteRiskDenominator', (row) => groupResult(row, input.strSiteRiskMetric || 'Analysis_srs0001')?.Denominator, 'number'],
            ['ComparisonRiskScore', (row) => groupResult(row, comparisonMetric)?.Score, 'number'],
            ['ComparisonRiskNumerator', (row) => groupResult(row, comparisonMetric)?.Numerator, 'number'],
            ['ComparisonRiskDenominator', (row) => groupResult(row, comparisonMetric)?.Denominator, 'number'],
            ['ComparisonRiskMetricID', () => comparisonMetric],
            ['ComparisonRiskLabel', () => input.strComparisonRiskLabel],
            ['ActionPolicy', (row) => row.ActionPolicy],
            ['ActionAsOfDate', (row) => row.ActionAsOfDate, 'date'],
            ['ActionExtractionDate', (row) => row.ActionExtractionDate || row.ExtractionDate, 'date'],
            ['RiskSignalID', (row) => row.RiskSignalID || row.ActionRiskSignalID],
            ['ActionID', (row) => row.ActionID]
        ];
        const encode = (value, type) => {
            if (isMissing(value)) return '';
            if (type === 'number') return Number.isFinite(Number(value)) ? String(Number(value)) : '';
            if (type === 'boolean') {
                if ([true, 'true', 'TRUE', 1, '1'].includes(value)) return 'true';
                if ([false, 'false', 'FALSE', 0, '0'].includes(value)) return 'false';
                return '';
            }
            if (type === 'date') {
                const timestamp = Date.parse(value);
                return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : '';
            }
            let text = String(value);
            if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const groups = Object.keys(detailByGroup).sort((left, right) => kriOrder.compare(left, right));
        const rows = groups.flatMap((group) => reviewRows(detailByGroup[group]));
        const csv = [columns.map(([name]) => encode(name)).join(','),
            ...rows.map((row) => columns.map(([, value, type]) => encode(value(row), type)).join(','))]
            .join('\r\n') + '\r\n';
        const context = rows[0];
        const study = context && (context.StudyID || groupResult(context, comparisonMetric)?.StudyID);
        const snapshot = context && (context.ActionAsOfDate || context.SnapshotDate || groupResult(context, comparisonMetric)?.SnapshotDate);
        const filename = ['risk-review', study, snapshot].filter((value) => !isMissing(value))
            .map((value) => String(value).replace(/[^A-Za-z0-9._-]/g, '_')).join('_') + '.csv';
        const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const buildPanel = () => {
        const panel = document.createElement('div');
        panel.style.cssText = 'padding: 4px 8px 8px; font-size: 0.9em; text-align: left; overflow-x: auto;';

        const rows = reviewRows(detailByGroup[selectedGroup] || []);

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
            ? ['KRI', 'Flag', 'Action state', 'Last Addressed', 'Days Ago', 'Counted']
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
            const counted = countedLabel(row);
            const line = document.createElement('div');
            line.setAttribute('role', 'row');
            line.dataset.metricId = row.MetricID;
            line.style.display = 'contents';
            if (!dateWindowMode && counted === 'No') line.style.color = '#666';
            const displayedFlag = detailFlag(row);
            const displayedActionState = displayedState(row);
            const values = [
                metricLabels[row.MetricID] || row.MetricID,
                isMissing(displayedFlag) ? '-' : displayedFlag,
                isMissing(displayedActionState) ? 'Missing' : displayedActionState,
                ...(dateWindowMode ? [
                    isMissing(row.LastActionedDate) ? '-' : row.LastActionedDate,
                    isMissing(row.DaysSinceAction) ? '-' : row.DaysSinceAction
                ] : [isMissing(row.ActionSnapshotDate) ? '-' : row.ActionSnapshotDate]),
                counted
            ];
            values.forEach((value) => addCell(line, value));
            line.title = dateWindowMode
                ? `${latestActionText(row)} As of: ${row.ActionAsOfDate}; latest flagged snapshot: ${row.LastFlaggedDate || '-'}; current flag: ${isMissing(row.Flag) ? '-' : row.Flag}; extraction: ${row.ActionExtractionDate || '-'}; source: ${row.ActionedDateSource || '-'}; reason: ${actionReason(row)}`
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
            const highlighted = highlightRecentActions && recent;
            cell.classList.toggle('group-overview--recent-action', Boolean(highlighted));
            cell.style.boxShadow = highlighted ? `inset 0 0 0 1px ${highlightColor(row)}` : '';
            if (row) {
                const action = latestActionText(row);
                cell.title = action;
                cell.setAttribute('aria-description', action);
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

    controls = document.createElement('div');
    controls.className = 'group-overview--action-controls';
    controls.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 0;';
    if (dateWindowMode) {
        const highlightLabel = document.createElement('label');
        highlightLabel.style.cssText = 'max-width: 100%; min-width: 0;';
        const highlightCheckbox = document.createElement('input');
        highlightCheckbox.type = 'checkbox';
        highlightCheckbox.checked = highlightRecentActions;
        highlightCheckbox.addEventListener('change', () => {
            highlightRecentActions = highlightCheckbox.checked;
            refresh(false);
        });
        highlightLabel.append(highlightCheckbox, document.createTextNode(' Highlight actions within 90 days'));
        controls.appendChild(highlightLabel);
        const table = el.querySelector('table.group-overview');
        tableScroll = document.createElement('div');
        tableScroll.className = 'group-overview--comparison-scroll';
        tableScroll.style.cssText = 'max-width: 100%; overflow-x: auto;';
        tableScroll.tabIndex = 0;
        tableScroll.setAttribute('role', 'region');
        tableScroll.setAttribute('aria-label', 'Site risk and review priority scores');
        table.before(tableScroll);
        tableScroll.appendChild(table);
    }
    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className = 'btn btn-default btn-sm';
    downloadButton.title = 'Download review rows for all sites, independent of table filters and highlighting.';
    if (input.strDownloadIcon) {
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = input.strDownloadIcon;
        downloadButton.appendChild(icon);
    }
    downloadButton.appendChild(document.createTextNode(' Download CSV'));
    downloadButton.addEventListener('click', downloadCsv);
    controls.appendChild(downloadButton);
    el.insertBefore(controls, tableScroll || el.querySelector('table.group-overview'));
    return () => {
        observer.disconnect();
        el.removeEventListener('click', toggleDetail);
        el.removeEventListener('keydown', keyboardDetail);
        el.removeEventListener('click', beforeSort, true);
        if (controls) controls.remove();
        if (tableScroll) tableScroll.replaceWith(...tableScroll.childNodes);
    };
};
