// Darts League App — Supabase Edition

(function() {
  'use strict';

  // ===== SUPABASE CLIENT =====
  const SUPABASE_URL = 'https://wugoalsqbchxxumfccfa.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_WS-jTIGF2vlsx8eb7gcRpA_1NkE5eFg';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===== STATE =====
  let currentSeasonId = null;
  let seasonsData = [];
  let seasonPlayersData = [];
  let allMatches = [];
  let editingMatchId = null;
  let positionChart = null;

  // ===== COLOR PALETTE (dynamic assignment by index) =====
  const COLOR_PALETTE = [
    { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },   // Blue
    { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },     // Green
    { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },   // Orange
    { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },   // Purple
    { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },   // Pink
    { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },   // Teal
    { bg: 'rgba(245, 158, 11, 0.8)', border: 'rgb(245, 158, 11)' },   // Amber
    { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' }      // Red
  ];

  function getPlayerColor(index) {
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  }

  // ===== DB MAPPING =====
  function mapMatchFromDb(row) {
    return {
      id: row.id,
      seasonId: row.season_id,
      date: row.date,
      player1Id: row.player1_id,
      player2Id: row.player2_id,
      player1Legs: row.player1_legs,
      player2Legs: row.player2_legs,
      player1HighCheckout: row.player1_high_checkout,
      player2HighCheckout: row.player2_high_checkout,
      player1HighVisit: row.player1_high_visit,
      player2HighVisit: row.player2_high_visit
    };
  }

  // ===== DATA FETCHING =====
  async function fetchSeasons() {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async function fetchSeasonPlayers(seasonId) {
    const { data, error } = await supabase
      .from('season_players')
      .select('player_id, players(id, name)')
      .eq('season_id', seasonId);
    if (error) throw error;
    return data.map(sp => ({ id: sp.players.id, name: sp.players.name }));
  }

  async function fetchMatches(seasonId) {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', seasonId)
      .order('date', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw error;
    return data.map(mapMatchFromDb);
  }

  async function fetchAllPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  }

  // ===== THEME =====
  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      if (seasonPlayersData.length > 0) {
        renderPositionChart(seasonPlayersData);
      }
    });
  }

  // ===== TABS =====
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${targetTab}-section`) {
            content.classList.add('active');
          }
        });

        if (targetTab === 'stats' && seasonPlayersData.length > 0) {
          setTimeout(() => renderPositionChart(seasonPlayersData), 50);
        }

        if (targetTab === 'manage') {
          renderManageSection();
        }
      });
    });
  }

  function switchToTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) btn.classList.add('active');
    });

    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabName}-section`) content.classList.add('active');
    });

    if (tabName === 'stats' && seasonPlayersData.length > 0) {
      setTimeout(() => renderPositionChart(seasonPlayersData), 50);
    }
  }

  // ===== CALCULATIONS (unchanged logic) =====

  function calculateForm(playerId, matches) {
    const playerMatches = matches
      .filter(m => m.player1Id === playerId || m.player2Id === playerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    const form = playerMatches.reverse().map(match => {
      const isPlayer1 = match.player1Id === playerId;
      const playerLegs = isPlayer1 ? match.player1Legs : match.player2Legs;
      return playerLegs === 3 ? 'W' : 'L';
    });

    while (form.length < 3) form.unshift('-');
    return form;
  }

  function calculatePositionHistory(players, matches) {
    if (matches.length === 0) return { weeks: [], positions: {} };

    const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));

    const weekGroups = {};
    sortedMatches.forEach(match => {
      const weekKey = match.date;
      if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
      weekGroups[weekKey].push(match);
    });

    const weeks = Object.keys(weekGroups).sort();
    const positions = {};
    players.forEach(p => { positions[p.id] = []; });

    let cumulativeMatches = [];
    weeks.forEach(week => {
      cumulativeMatches = [...cumulativeMatches, ...weekGroups[week]];
      const standings = calculateStandings(players, cumulativeMatches);
      standings.forEach((player, index) => {
        positions[player.id].push(index + 1);
      });
    });

    const weekLabels = weeks.map(dateStr => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });

    return { weeks: weekLabels, positions };
  }

  function calculateH2H(players, matches) {
    const h2h = {};

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const key = `${players[i].id}-${players[j].id}`;
        h2h[key] = {
          player1: players[i],
          player2: players[j],
          p1Wins: 0,
          p2Wins: 0
        };
      }
    }

    matches.forEach(match => {
      const p1 = match.player1Id;
      const p2 = match.player2Id;

      let key = `${p1}-${p2}`;
      let swapped = false;
      if (!h2h[key]) {
        key = `${p2}-${p1}`;
        swapped = true;
      }

      if (!h2h[key]) return;

      const p1Won = match.player1Legs === 3;

      if (swapped) {
        if (p1Won) h2h[key].p2Wins++;
        else h2h[key].p1Wins++;
      } else {
        if (p1Won) h2h[key].p1Wins++;
        else h2h[key].p2Wins++;
      }
    });

    return Object.values(h2h);
  }

  function calculateStandings(players, matches) {
    const stats = {};
    players.forEach(player => {
      stats[player.id] = {
        id: player.id,
        name: player.name,
        played: 0, won: 0, lost: 0, points: 0,
        legsFor: 0, legsAgainst: 0, legDiff: 0,
        highCheckout: 0, highVisit: 0,
        bonusCheckouts: 0, bonusVisits: 0
      };
    });

    matches.forEach(match => {
      const p1 = stats[match.player1Id];
      const p2 = stats[match.player2Id];
      if (!p1 || !p2) return;

      p1.played++;
      p2.played++;

      p1.legsFor += match.player1Legs;
      p1.legsAgainst += match.player2Legs;
      p2.legsFor += match.player2Legs;
      p2.legsAgainst += match.player1Legs;

      if (match.player1Legs === 3) { p1.won++; p2.lost++; }
      else if (match.player2Legs === 3) { p2.won++; p1.lost++; }

      if (match.player1HighCheckout && match.player1HighCheckout > p1.highCheckout) p1.highCheckout = match.player1HighCheckout;
      if (match.player2HighCheckout && match.player2HighCheckout > p2.highCheckout) p2.highCheckout = match.player2HighCheckout;
      if (match.player1HighVisit && match.player1HighVisit > p1.highVisit) p1.highVisit = match.player1HighVisit;
      if (match.player2HighVisit && match.player2HighVisit > p2.highVisit) p2.highVisit = match.player2HighVisit;

      if (match.player1HighCheckout && match.player1HighCheckout >= 50) p1.bonusCheckouts++;
      if (match.player2HighCheckout && match.player2HighCheckout >= 50) p2.bonusCheckouts++;
      if (match.player1HighVisit && match.player1HighVisit >= 150) p1.bonusVisits++;
      if (match.player2HighVisit && match.player2HighVisit >= 150) p2.bonusVisits++;
    });

    const standings = Object.values(stats).map(player => {
      player.legDiff = player.legsFor - player.legsAgainst;
      player.points = (player.won * 3) + player.bonusCheckouts + player.bonusVisits;
      return player;
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.legDiff - a.legDiff;
    });

    return standings;
  }

  function calculateMatchPoints(match) {
    let p1Points = 0;
    let p2Points = 0;

    if (match.player1Legs === 3) p1Points += 3;
    else if (match.player2Legs === 3) p2Points += 3;

    if (match.player1HighCheckout && match.player1HighCheckout >= 50) p1Points += 1;
    if (match.player2HighCheckout && match.player2HighCheckout >= 50) p2Points += 1;
    if (match.player1HighVisit && match.player1HighVisit >= 150) p1Points += 1;
    if (match.player2HighVisit && match.player2HighVisit >= 150) p2Points += 1;

    return { p1Points, p2Points };
  }

  // ===== RENDER: POSITION CHART (dynamic colors + dynamic y-axis) =====

  function renderPositionChart(players) {
    const canvas = document.getElementById('position-chart');
    if (!canvas) return;

    const chartContainer = canvas.parentElement;
    let emptyState = chartContainer.querySelector('.chart-empty-state');
    if (!emptyState) {
      emptyState = document.createElement('p');
      emptyState.className = 'empty-state chart-empty-state';
      emptyState.textContent = 'No matches played yet';
      chartContainer.appendChild(emptyState);
    }

    if (!players || players.length === 0 || !allMatches || allMatches.length === 0) {
      canvas.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    const { weeks, positions } = calculatePositionHistory(players, allMatches);

    if (!weeks || weeks.length === 0) {
      canvas.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    canvas.style.display = 'block';
    emptyState.style.display = 'none';

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#a0a0a0' : '#6c757d';

    const datasets = players.map((player, index) => ({
      label: player.name,
      data: positions[player.id] || [],
      borderColor: getPlayerColor(index).border,
      backgroundColor: getPlayerColor(index).bg,
      borderWidth: 3,
      tension: 0.1,
      pointRadius: 6,
      pointHoverRadius: 8
    }));

    if (positionChart) {
      positionChart.destroy();
      positionChart = null;
    }

    try {
      positionChart = new Chart(canvas, {
        type: 'line',
        data: { labels: weeks, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              reverse: true,
              min: 1,
              max: players.length,
              ticks: {
                stepSize: 1,
                callback: function(value) {
                  if (!Number.isInteger(value)) return '';
                  const s = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th';
                  return value + s;
                },
                color: textColor
              },
              grid: { color: gridColor }
            },
            x: {
              ticks: { color: textColor },
              grid: { color: gridColor }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, usePointStyle: true, padding: 20 }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const pos = context.raw;
                  const s = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
                  return `${context.dataset.label}: ${pos}${s}`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to create position chart:', error);
    }
  }

  // ===== RENDER: H2H =====

  function renderH2H(players) {
    const container = document.getElementById('h2h-grid');
    if (!container) return;

    const h2hData = calculateH2H(players, allMatches);

    if (allMatches.length === 0) {
      container.innerHTML = '<p class="empty-state">No matches played yet</p>';
      return;
    }

    container.innerHTML = h2hData.map(record => {
      let recordClass = 'even';
      if (record.p1Wins > record.p2Wins) recordClass = 'p1-leads';
      else if (record.p2Wins > record.p1Wins) recordClass = 'p2-leads';

      return `
        <div class="h2h-item">
          <span class="h2h-players">${record.player1.name} vs ${record.player2.name}</span>
          <span class="h2h-record ${recordClass}">${record.p1Wins} - ${record.p2Wins}</span>
        </div>
      `;
    }).join('');
  }

  function renderStats() {
    renderPositionChart(seasonPlayersData);
    renderH2H(seasonPlayersData);
  }

  // ===== RENDER: STANDINGS =====

  function renderStandings(standings) {
    const tbody = document.querySelector('#standings-table tbody');

    if (standings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-state">
            <p>No matches played yet</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = standings.map((player, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      const legDiffDisplay = player.legDiff > 0 ? `+${player.legDiff}` : player.legDiff;
      const highCheckout = player.highCheckout || '-';
      const highVisit = player.highVisit || '-';

      const form = calculateForm(player.id, allMatches);
      const formHtml = form.map(result => {
        const className = result === 'W' ? 'win' : result === 'L' ? 'loss' : 'none';
        return `<span class="form-result ${className}">${result}</span>`;
      }).join('');

      return `
        <tr>
          <td class="col-rank ${rankClass}">${rank}</td>
          <td class="col-player">${player.name}</td>
          <td class="col-form"><div class="form-indicator">${formHtml}</div></td>
          <td class="col-num">${player.played}</td>
          <td class="col-num">${player.won}</td>
          <td class="col-num">${player.lost}</td>
          <td class="col-num highlight">${player.points}</td>
          <td class="col-num hide-mobile">${player.legsFor}</td>
          <td class="col-num hide-mobile">${player.legsAgainst}</td>
          <td class="col-num">${legDiffDisplay}</td>
          <td class="col-num hide-mobile">${highCheckout}</td>
          <td class="col-num hide-mobile">${highVisit}</td>
        </tr>
      `;
    }).join('');
  }

  // ===== GET PLAYER NAME =====

  function getPlayerName(playerId) {
    const player = seasonPlayersData.find(p => p.id === playerId);
    return player ? player.name : `Player ${playerId}`;
  }

  // ===== RENDER: MATCH HISTORY =====

  function renderHistory() {
    const tbody = document.querySelector('#history-table tbody');

    if (allMatches.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <p>No matches played yet</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = allMatches.map(match => {
      const p1Name = getPlayerName(match.player1Id);
      const p2Name = getPlayerName(match.player2Id);
      const p1Won = match.player1Legs === 3;
      const p2Won = match.player2Legs === 3;
      const { p1Points, p2Points } = calculateMatchPoints(match);

      const stats = [];
      if (match.player1HighCheckout) stats.push(`${p1Name} HC: ${match.player1HighCheckout}`);
      if (match.player2HighCheckout) stats.push(`${p2Name} HC: ${match.player2HighCheckout}`);
      if (match.player1HighVisit) stats.push(`${p1Name} HV: ${match.player1HighVisit}`);
      if (match.player2HighVisit) stats.push(`${p2Name} HV: ${match.player2HighVisit}`);
      const statsStr = stats.length > 0 ? stats.join(', ') : '-';

      const date = new Date(match.date);
      const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      return `
        <tr>
          <td class="col-date">${dateStr}</td>
          <td class="col-match">
            <span class="${p1Won ? 'match-winner' : 'match-loser'}">${p1Name}</span>
            <span class="match-loser"> vs </span>
            <span class="${p2Won ? 'match-winner' : 'match-loser'}">${p2Name}</span>
          </td>
          <td class="col-score">${match.player1Legs} - ${match.player2Legs}</td>
          <td class="col-stats hide-mobile">${statsStr}</td>
          <td class="col-pts">
            <span class="pts-badge">${p1Points}</span> - <span class="pts-badge">${p2Points}</span>
          </td>
          <td class="col-actions">
            <button class="btn-action btn-edit" data-match-id="${match.id}" title="Edit match">✏️</button>
            <button class="btn-action btn-delete" data-match-id="${match.id}" title="Delete match">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => handleEditClick(parseInt(btn.dataset.matchId)));
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteClick(parseInt(btn.dataset.matchId)));
    });
  }

  // ===== REFRESH =====

  function refreshDisplays() {
    const standings = calculateStandings(seasonPlayersData, allMatches);
    renderStandings(standings);
    renderHistory();
    renderFixtures();
    renderStats();
  }

  async function refreshAfterChange() {
    allMatches = await fetchMatches(currentSeasonId);
    refreshDisplays();
  }

  // ===== FORM: DATE HELPER =====

  function setDefaultDate() {
    const dateInput = document.getElementById('matchDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  }

  // ===== FORM: EDIT / CANCEL =====

  function handleEditClick(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;

    editingMatchId = matchId;

    document.getElementById('form-title').textContent = 'Edit Match Result';
    document.getElementById('form-submit-btn').textContent = 'Update Match';
    document.getElementById('form-cancel-btn').hidden = false;

    const form = document.getElementById('match-form');
    form.matchDate.value = match.date;
    form.player1.value = match.player1Id;
    form.player2.value = match.player2Id;
    form.player1Legs.value = match.player1Legs;
    form.player2Legs.value = match.player2Legs;
    form.player1HighCheckout.value = match.player1HighCheckout || '';
    form.player2HighCheckout.value = match.player2HighCheckout || '';
    form.player1HighVisit.value = match.player1HighVisit || '';
    form.player2HighVisit.value = match.player2HighVisit || '';

    switchToTab('add-result');
    document.querySelector('.match-form-section').scrollIntoView({ behavior: 'smooth' });
  }

  function handleCancelEdit() {
    editingMatchId = null;
    document.getElementById('form-title').textContent = 'Add Match Result';
    document.getElementById('form-submit-btn').textContent = 'Add Match';
    document.getElementById('form-cancel-btn').hidden = true;
    document.getElementById('match-form').reset();
    setDefaultDate();
    document.getElementById('form-message').hidden = true;
  }

  // ===== CONFIRM DIALOG =====

  function showConfirmDialog(message, onConfirm, title, confirmText) {
    title = title || 'Confirm';
    confirmText = confirmText || 'Confirm';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-dialog-content">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-dialog-actions">
          <button class="btn-dialog-cancel">Cancel</button>
          <button class="btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('.btn-dialog-cancel').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    dialog.querySelector('.btn-confirm').addEventListener('click', () => {
      document.body.removeChild(dialog);
      onConfirm();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) document.body.removeChild(dialog);
    });
  }

  // ===== FORM: DELETE =====

  function handleDeleteClick(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;

    const p1Name = getPlayerName(match.player1Id);
    const p2Name = getPlayerName(match.player2Id);

    showConfirmDialog(
      `Are you sure you want to delete the match between ${p1Name} and ${p2Name} (${match.player1Legs}-${match.player2Legs})?`,
      async () => {
        try {
          const { error } = await supabase.from('matches').delete().eq('id', matchId);
          if (error) throw error;
          if (editingMatchId === matchId) handleCancelEdit();
          await refreshAfterChange();
          showFormMessage('Match deleted successfully');
        } catch (err) {
          showFormMessage('Failed to delete match: ' + err.message, 'error');
        }
      },
      'Confirm Delete',
      'Delete'
    );
  }

  // ===== FORM: DROPDOWNS =====

  function populatePlayerDropdowns(players) {
    const player1Select = document.getElementById('player1');
    const player2Select = document.getElementById('player2');

    const options = players.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');

    player1Select.innerHTML = '<option value="">Select player...</option>' + options;
    player2Select.innerHTML = '<option value="">Select player...</option>' + options;
  }

  // ===== FORM: MESSAGE =====

  function showFormMessage(message, type = 'success') {
    const msgEl = document.getElementById('form-message');
    msgEl.textContent = message;
    msgEl.className = `form-message ${type}`;
    msgEl.hidden = false;
    setTimeout(() => { msgEl.hidden = true; }, 5000);
  }

  // ===== FORM: VALIDATION =====

  function validateMatchForm(formData) {
    const errors = [];

    if (!formData.date) errors.push('Please select a date');
    if (!formData.player1Id) errors.push('Please select Player 1');
    if (!formData.player2Id) errors.push('Please select Player 2');

    if (formData.player1Id && formData.player2Id && formData.player1Id === formData.player2Id) {
      errors.push('Players cannot be the same');
    }

    const p1Legs = formData.player1Legs;
    const p2Legs = formData.player2Legs;

    if (p1Legs < 0 || p1Legs > 3 || p2Legs < 0 || p2Legs > 3) {
      errors.push('Legs must be between 0 and 3');
    }

    if (p1Legs !== 3 && p2Legs !== 3) {
      errors.push('One player must have 3 legs (the winner)');
    }

    if (p1Legs === 3 && p2Legs === 3) {
      errors.push('Only one player can have 3 legs');
    }

    return errors;
  }

  // ===== FORM: SUBMIT (async) =====

  async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = document.getElementById('form-submit-btn');

    const formData = {
      date: form.matchDate.value,
      player1Id: parseInt(form.player1.value, 10),
      player2Id: parseInt(form.player2.value, 10),
      player1Legs: parseInt(form.player1Legs.value, 10),
      player2Legs: parseInt(form.player2Legs.value, 10),
      player1HighCheckout: form.player1HighCheckout.value ? parseInt(form.player1HighCheckout.value, 10) : null,
      player2HighCheckout: form.player2HighCheckout.value ? parseInt(form.player2HighCheckout.value, 10) : null,
      player1HighVisit: form.player1HighVisit.value ? parseInt(form.player1HighVisit.value, 10) : null,
      player2HighVisit: form.player2HighVisit.value ? parseInt(form.player2HighVisit.value, 10) : null
    };

    const errors = validateMatchForm(formData);
    if (errors.length > 0) {
      showFormMessage(errors.join('. '), 'error');
      return;
    }

    const isEditing = editingMatchId !== null;
    const p1Name = getPlayerName(formData.player1Id);
    const p2Name = getPlayerName(formData.player2Id);

    try {
      submitBtn.disabled = true;

      if (isEditing) {
        const { error } = await supabase.from('matches').update({
          date: formData.date,
          player1_id: formData.player1Id,
          player2_id: formData.player2Id,
          player1_legs: formData.player1Legs,
          player2_legs: formData.player2Legs,
          player1_high_checkout: formData.player1HighCheckout,
          player2_high_checkout: formData.player2HighCheckout,
          player1_high_visit: formData.player1HighVisit,
          player2_high_visit: formData.player2HighVisit
        }).eq('id', editingMatchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('matches').insert({
          season_id: currentSeasonId,
          date: formData.date,
          player1_id: formData.player1Id,
          player2_id: formData.player2Id,
          player1_legs: formData.player1Legs,
          player2_legs: formData.player2Legs,
          player1_high_checkout: formData.player1HighCheckout,
          player2_high_checkout: formData.player2HighCheckout,
          player1_high_visit: formData.player1HighVisit,
          player2_high_visit: formData.player2HighVisit
        });
        if (error) throw error;
      }

      handleCancelEdit();
      await refreshAfterChange();

      const verb = isEditing ? 'updated' : 'added';
      showFormMessage(`Match ${verb}: ${p1Name} ${formData.player1Legs} - ${formData.player2Legs} ${p2Name}`);
    } catch (err) {
      showFormMessage('Failed to save match: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  // ===== CSV EXPORT (unchanged) =====

  function exportToCSV() {
    if (allMatches.length === 0) {
      alert('No matches to export!');
      return;
    }

    const headers = [
      'Date', 'Player 1', 'Player 2', 'P1 Legs', 'P2 Legs',
      'P1 High Checkout', 'P2 High Checkout', 'P1 High Visit', 'P2 High Visit', 'Winner'
    ];

    const rows = allMatches.map(match => {
      const p1Name = getPlayerName(match.player1Id);
      const p2Name = getPlayerName(match.player2Id);
      const winner = match.player1Legs === 3 ? p1Name : p2Name;

      return [
        match.date, p1Name, p2Name, match.player1Legs, match.player2Legs,
        match.player1HighCheckout || '', match.player2HighCheckout || '',
        match.player1HighVisit || '', match.player2HighVisit || '', winner
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `darts-league-matches-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function initExportButton() {
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
  }

  // ===== FIXTURES (dynamic player count) =====

  function generateRoundRobinPairs(players) {
    const pairs = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        pairs.push([players[i].id, players[j].id]);
      }
    }
    return pairs;
  }

  function getHeadToHead(matches, player1Id, player2Id) {
    let p1Wins = 0;
    let p2Wins = 0;

    matches.forEach(m => {
      if (m.player1Id === player1Id && m.player2Id === player2Id) {
        if (m.player1Legs === 3) p1Wins++;
        else if (m.player2Legs === 3) p2Wins++;
      } else if (m.player1Id === player2Id && m.player2Id === player1Id) {
        if (m.player1Legs === 3) p2Wins++;
        else if (m.player2Legs === 3) p1Wins++;
      }
    });

    return { p1Wins, p2Wins, total: p1Wins + p2Wins };
  }

  function getRemainingCurrentRound(players, matches) {
    const allPairs = generateRoundRobinPairs(players);
    const remaining = [];

    const pairCounts = {};
    allPairs.forEach(([p1, p2]) => {
      const key = [p1, p2].sort((a, b) => a - b).join('-');
      pairCounts[key] = 0;
    });

    matches.forEach(m => {
      const key = [m.player1Id, m.player2Id].sort((a, b) => a - b).join('-');
      if (pairCounts[key] !== undefined) pairCounts[key]++;
    });

    const minMatches = Math.min(...Object.values(pairCounts));

    allPairs.forEach(([p1, p2]) => {
      const key = [p1, p2].sort((a, b) => a - b).join('-');
      if (pairCounts[key] === minMatches) remaining.push([p1, p2]);
    });

    return remaining;
  }

  function generateFixtureSchedule(players, matches) {
    if (players.length < 2) return [];

    const schedule = [];
    const matchesPerWeek = Math.floor(players.length / 2);
    const allPairs = generateRoundRobinPairs(players);
    const pairsPerRound = allPairs.length;
    const weeksPerRound = Math.ceil(pairsPerRound / matchesPerWeek);

    const weeksCompleted = matchesPerWeek > 0 ? Math.floor(matches.length / matchesPerWeek) : 0;
    const currentRoundNumber = weeksPerRound > 0 ? Math.floor(weeksCompleted / weeksPerRound) + 1 : 1;
    const weekInRound = weeksPerRound > 0 ? (weeksCompleted % weeksPerRound) + 1 : 1;

    const remainingCurrent = getRemainingCurrentRound(players, matches);

    if (remainingCurrent.length > 0) {
      for (let i = 0; i < remainingCurrent.length; i += matchesPerWeek) {
        const weekMatches = remainingCurrent.slice(i, i + matchesPerWeek);
        const weekNum = weekInRound + Math.floor(i / matchesPerWeek);
        schedule.push({
          title: `Round ${currentRoundNumber} - Week ${weekNum}`,
          badge: i === 0 ? 'current' : null,
          matches: weekMatches
        });
      }
    }

    // Next round
    const nextRoundNumber = currentRoundNumber + 1;
    schedule.push({ type: 'divider', label: `Round ${nextRoundNumber}` });

    for (let i = 0; i < weeksPerRound; i++) {
      const weekMatches = allPairs.slice(i * matchesPerWeek, (i + 1) * matchesPerWeek);
      if (weekMatches.length > 0) {
        schedule.push({
          title: `Round ${nextRoundNumber} - Week ${i + 1}`,
          badge: 'next-round',
          matches: weekMatches
        });
      }
    }

    return schedule;
  }

  function renderFixtures() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    const schedule = generateFixtureSchedule(seasonPlayersData, allMatches);

    if (schedule.length === 0) {
      container.innerHTML = '<div class="fixtures-empty"><p>No upcoming fixtures</p></div>';
      return;
    }

    let html = '';

    schedule.forEach(item => {
      if (item.type === 'divider') {
        html += `
          <div class="fixtures-round-divider">
            <span class="fixtures-round-label">${item.label}</span>
          </div>
        `;
        return;
      }

      html += `
        <div class="fixtures-week">
          <div class="fixtures-week-header">
            <span class="fixtures-week-title">${item.title}</span>
            ${item.badge === 'current' ? '<span class="fixtures-week-badge current">Up Next</span>' : ''}
          </div>
      `;

      item.matches.forEach(([p1Id, p2Id]) => {
        const p1Name = getPlayerName(p1Id);
        const p2Name = getPlayerName(p2Id);
        const h2h = getHeadToHead(allMatches, p1Id, p2Id);

        let h2hHtml = '';
        if (h2h.total > 0) {
          h2hHtml = `
            <div class="fixture-h2h">
              H2H: <span class="fixture-h2h-record">${p1Name} ${h2h.p1Wins} - ${h2h.p2Wins} ${p2Name}</span>
            </div>
          `;
        }

        html += `
          <div class="fixture-card">
            <div class="fixture-player player-left">${p1Name}</div>
            <div class="fixture-vs">VS</div>
            <div class="fixture-player player-right">${p2Name}</div>
          </div>
          ${h2hHtml}
        `;
      });

      html += '</div>';
    });

    container.innerHTML = html;
  }

  // ===== SEASON SELECTOR =====

  function renderSeasonSelector() {
    const select = document.getElementById('season-selector');
    select.innerHTML = seasonsData.map(s =>
      `<option value="${s.id}" ${s.id === currentSeasonId ? 'selected' : ''}>${s.name}${s.is_active ? ' ✦' : ''}</option>`
    ).join('');
  }

  function initSeasonSelector() {
    const select = document.getElementById('season-selector');
    select.addEventListener('change', async () => {
      currentSeasonId = parseInt(select.value, 10);
      await loadSeasonData(currentSeasonId);
    });
  }

  // ===== MANAGE SECTION =====

  async function renderManageSection() {
    const container = document.getElementById('manage-container');
    if (!container) return;

    let allPlayers;
    try {
      allPlayers = await fetchAllPlayers();
    } catch (err) {
      container.innerHTML = '<p class="empty-state">Failed to load player data</p>';
      return;
    }

    const activeSeason = seasonsData.find(s => s.is_active);
    let currentPlayers = [];
    if (activeSeason) {
      try {
        currentPlayers = await fetchSeasonPlayers(activeSeason.id);
      } catch (err) {
        console.error('Failed to fetch season players:', err);
      }
    }
    const currentPlayerIds = currentPlayers.map(p => p.id);
    const availablePlayers = allPlayers.filter(p => !currentPlayerIds.includes(p.id));

    let html = '';

    // Season Management
    html += '<div class="manage-card"><h3>Seasons</h3>';

    if (activeSeason) {
      html += `
        <p class="manage-info">Active: <strong>${activeSeason.name}</strong></p>
        <button class="btn-danger" id="end-season-btn">End ${activeSeason.name}</button>`;
    } else {
      html += '<p class="manage-info">No active season</p>';
    }

    html += `
      <div class="manage-form">
        <h4>Start New Season</h4>
        <div class="form-group">
          <label for="new-season-name">Season Name</label>
          <input type="text" id="new-season-name" placeholder="e.g. Season 2">
        </div>
        <div class="form-group">
          <label>Players</label>
          <div id="new-season-players" class="checkbox-list">
            ${allPlayers.map(p => `
              <label class="checkbox-item">
                <input type="checkbox" value="${p.id}" checked>
                ${p.name}
              </label>
            `).join('')}
          </div>
        </div>
        <button class="btn-submit" id="start-season-btn">Start New Season</button>
      </div>
    </div>`;

    // Player Management
    html += '<div class="manage-card"><h3>Players</h3>';

    if (activeSeason) {
      html += `<h4>In ${activeSeason.name}</h4>
        <div class="player-list">
          ${currentPlayers.length > 0 ? currentPlayers.map(p => `
            <div class="player-list-item">
              <span>${p.name}</span>
              <button class="btn-remove-player" data-player-id="${p.id}">Remove</button>
            </div>
          `).join('') : '<p class="manage-info">No players in this season</p>'}
        </div>`;

      if (availablePlayers.length > 0) {
        html += `
          <div class="manage-form">
            <h4>Add to Season</h4>
            <div class="inline-form">
              <select id="add-player-to-season-select">
                <option value="">Select player...</option>
                ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
              <button class="btn-submit btn-sm" id="add-player-to-season-btn">Add</button>
            </div>
          </div>`;
      }
    }

    html += `
      <div class="manage-form">
        <h4>Create New Player</h4>
        <div class="inline-form">
          <input type="text" id="new-player-name" placeholder="Player name">
          <button class="btn-submit btn-sm" id="create-player-btn">Create</button>
        </div>
      </div>
    </div>`;

    container.innerHTML = html;

    // ---- Event listeners ----

    // End season
    const endSeasonBtn = document.getElementById('end-season-btn');
    if (endSeasonBtn && activeSeason) {
      endSeasonBtn.addEventListener('click', () => {
        showConfirmDialog(
          `End ${activeSeason.name}? This will mark the season as inactive.`,
          async () => {
            try {
              endSeasonBtn.disabled = true;
              const { error } = await supabase.from('seasons').update({ is_active: false }).eq('id', activeSeason.id);
              if (error) throw error;
              seasonsData = await fetchSeasons();
              renderSeasonSelector();
              await renderManageSection();
              showFormMessage(`${activeSeason.name} ended`);
            } catch (err) {
              showFormMessage('Failed to end season: ' + err.message, 'error');
            }
          },
          'End Season',
          'End Season'
        );
      });
    }

    // Start new season
    const startSeasonBtn = document.getElementById('start-season-btn');
    if (startSeasonBtn) {
      startSeasonBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-season-name').value.trim();
        if (!name) {
          showFormMessage('Please enter a season name', 'error');
          return;
        }
        const checkboxes = document.querySelectorAll('#new-season-players input[type="checkbox"]:checked');
        const playerIds = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
        if (playerIds.length < 2) {
          showFormMessage('Select at least 2 players', 'error');
          return;
        }
        try {
          startSeasonBtn.disabled = true;
          const { data: season, error: sErr } = await supabase
            .from('seasons').insert({ name, is_active: true }).select().single();
          if (sErr) throw sErr;

          const spRows = playerIds.map(pid => ({ season_id: season.id, player_id: pid }));
          const { error: spErr } = await supabase.from('season_players').insert(spRows);
          if (spErr) throw spErr;

          seasonsData = await fetchSeasons();
          currentSeasonId = season.id;
          renderSeasonSelector();
          await loadSeasonData(currentSeasonId);
          await renderManageSection();
          showFormMessage(`${name} started!`);
        } catch (err) {
          showFormMessage('Failed to start season: ' + err.message, 'error');
        } finally {
          startSeasonBtn.disabled = false;
        }
      });
    }

    // Remove player from season
    container.querySelectorAll('.btn-remove-player').forEach(btn => {
      btn.addEventListener('click', () => {
        const playerId = parseInt(btn.dataset.playerId, 10);
        const playerName = currentPlayers.find(p => p.id === playerId)?.name;
        showConfirmDialog(
          `Remove ${playerName} from ${activeSeason.name}?`,
          async () => {
            try {
              const { error } = await supabase.from('season_players').delete()
                .eq('season_id', activeSeason.id).eq('player_id', playerId);
              if (error) throw error;
              if (currentSeasonId === activeSeason.id) {
                seasonPlayersData = await fetchSeasonPlayers(currentSeasonId);
                populatePlayerDropdowns(seasonPlayersData);
                refreshDisplays();
              }
              await renderManageSection();
              showFormMessage(`${playerName} removed`);
            } catch (err) {
              showFormMessage('Failed to remove player: ' + err.message, 'error');
            }
          },
          'Remove Player',
          'Remove'
        );
      });
    });

    // Add player to season
    const addToSeasonBtn = document.getElementById('add-player-to-season-btn');
    if (addToSeasonBtn) {
      addToSeasonBtn.addEventListener('click', async () => {
        const select = document.getElementById('add-player-to-season-select');
        const playerId = parseInt(select.value, 10);
        if (!playerId) {
          showFormMessage('Select a player', 'error');
          return;
        }
        try {
          addToSeasonBtn.disabled = true;
          const { error } = await supabase.from('season_players').insert({
            season_id: activeSeason.id,
            player_id: playerId
          });
          if (error) throw error;
          if (currentSeasonId === activeSeason.id) {
            seasonPlayersData = await fetchSeasonPlayers(currentSeasonId);
            populatePlayerDropdowns(seasonPlayersData);
            refreshDisplays();
          }
          await renderManageSection();
          showFormMessage('Player added to season');
        } catch (err) {
          showFormMessage('Failed to add player: ' + err.message, 'error');
        } finally {
          addToSeasonBtn.disabled = false;
        }
      });
    }

    // Create new player
    const createPlayerBtn = document.getElementById('create-player-btn');
    if (createPlayerBtn) {
      createPlayerBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('new-player-name');
        const name = nameInput.value.trim();
        if (!name) {
          showFormMessage('Please enter a player name', 'error');
          return;
        }
        try {
          createPlayerBtn.disabled = true;
          const { error } = await supabase.from('players').insert({ name });
          if (error) throw error;
          nameInput.value = '';
          await renderManageSection();
          showFormMessage(`Player "${name}" created`);
        } catch (err) {
          showFormMessage('Failed to create player: ' + err.message, 'error');
        } finally {
          createPlayerBtn.disabled = false;
        }
      });
    }
  }

  // ===== LOAD SEASON DATA =====

  async function loadSeasonData(seasonId) {
    seasonPlayersData = await fetchSeasonPlayers(seasonId);
    allMatches = await fetchMatches(seasonId);
    populatePlayerDropdowns(seasonPlayersData);
    refreshDisplays();
  }

  // ===== INIT FORM =====

  function initForm() {
    const form = document.getElementById('match-form');
    const cancelBtn = document.getElementById('form-cancel-btn');

    if (form) {
      form.addEventListener('submit', handleFormSubmit);
      populatePlayerDropdowns(seasonPlayersData);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleCancelEdit);
    }
  }

  // ===== INIT APP =====

  async function init() {
    initTheme();
    initTabs();

    const tbody = document.querySelector('#standings-table tbody');
    tbody.innerHTML = '<tr><td colspan="12" class="loading">Loading...</td></tr>';

    try {
      seasonsData = await fetchSeasons();

      if (seasonsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state"><p>No seasons yet. Go to Manage to create one.</p></td></tr>';
        initForm();
        initExportButton();
        setDefaultDate();
        return;
      }

      // Set current season to active one, or last one
      const activeSeason = seasonsData.find(s => s.is_active);
      currentSeasonId = activeSeason ? activeSeason.id : seasonsData[seasonsData.length - 1].id;

      renderSeasonSelector();
      await loadSeasonData(currentSeasonId);

      initForm();
      initExportButton();
      setDefaultDate();
      initSeasonSelector();
    } catch (error) {
      console.error('Failed to load data:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-state">
            <p>Failed to load data</p>
          </td>
        </tr>
      `;
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
