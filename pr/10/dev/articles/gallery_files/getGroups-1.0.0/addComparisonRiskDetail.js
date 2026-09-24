/**
 * Explain the comparison risk score column of a group overview table.
 *
 * Each comparison score gets a badge showing how far it is below the site risk
 * score, and clicking a comparison score lists the KRIs whose weight was
 * reduced in a panel below the table. Does nothing unless the comparison
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

    const panel = document.createElement('div');
    panel.className = 'group-overview--comparison-detail';
    panel.style.cssText = 'margin-top: 8px; font-size: 0.9em;';
    el.appendChild(panel);
    let selectedGroup = null;

    const renderPanel = () => {
        panel.innerHTML = '';
        if (selectedGroup === null) return;

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

        const table = document.createElement('table');
        table.className = 'group-overview--comparison-detail-table';
        table.style.cssText = 'border-collapse: collapse;';
        const header = ['KRI', 'Flag', 'Weight', 'Action state', 'ActionLog date', 'Effect'];
        const headRow = table.createTHead().insertRow();
        header.forEach((label) => {
            const th = document.createElement('th');
            th.textContent = label;
            th.style.cssText = 'text-align: left; padding: 2px 8px;';
            headRow.appendChild(th);
        });

        const body = table.createTBody();
        rows.forEach((row) => {
            const tr = body.insertRow();
            const reduced = row.reduction > 0;
            if (reduced) tr.style.color = '#c8102e';
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
                const td = tr.insertCell();
                td.textContent = value;
                td.style.cssText = 'padding: 2px 8px;';
            });
        });
        panel.appendChild(table);
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

    const observer = new MutationObserver(() => {
        observer.disconnect();
        applyBadges();
        observer.observe(el, { childList: true, subtree: true });
    });
    applyBadges();
    observer.observe(el, { childList: true, subtree: true });

    el.addEventListener('click', (event) => {
        const cell = event.target.closest('td.group-overview--comparisonRiskScore');
        if (!cell || !cell.__data__ || !detailByGroup[cell.__data__.GroupID]) return;
        const groupID = cell.__data__.GroupID;
        selectedGroup = selectedGroup === groupID ? null : groupID;
        observer.disconnect();
        renderPanel();
        observer.observe(el, { childList: true, subtree: true });
        // The panel sits below the table, which can be long.
        if (selectedGroup !== null) panel.scrollIntoView({ block: 'nearest' });
    });
};
