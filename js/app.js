// Darts League App

(function() {
  'use strict';

  const STORAGE_KEY = 'dartsLeague_matches';
  const EDITED_MATCHES_KEY = 'dartsLeague_editedMatches';
  const DELETED_MATCHES_KEY = 'dartsLeague_deletedMatchIds';
  const DATA_VERSION_KEY = 'dartsLeague_dataVersion';
  const CURRENT_DATA_VERSION = 3; // Increment this when data needs to be reset
  
  let playersData = [];
  let seedMatches = [];
  let allMatches = [];
  let editingMatchId = null;
  let positionChart = null;
  
  // Player colors for chart
  const PLAYER_COLORS = {
    'will': { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },     // Blue
    'cal': { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },        // Green
    'tom': { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },      // Orange
    'alex': { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' }      // Purple
  };

  // Check data version and clear localStorage if outdated
  function checkDataVersion() {
    try {
      const storedVersion = parseInt(localStorage.getItem(DATA_VERSION_KEY), 10);
      if (!storedVersion || storedVersion < CURRENT_DATA_VERSION) {
        // Clear all darts league data
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(EDITED_MATCHES_KEY);
        localStorage.removeItem(DELETED_MATCHES_KEY);
        localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION.toString());
        console.log('Data version updated, localStorage cleared');
      }
    } catch (e) {
      console.error('Failed to check data version:', e);
    }
  }

  // Theme management
  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      
      // Re-render chart with new theme colors
      if (playersData.length > 0) {
        renderPositionChart(playersData);
      }
    });
  }

  // Tab management
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update buttons
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${targetTab}-section`) {
            content.classList.add('active');
          }
        });
        
        // Re-render chart when Stats tab becomes visible
        // (Chart.js needs visible canvas to calculate dimensions properly)
        if (targetTab === 'stats' && playersData.length > 0) {
          // Small delay to ensure DOM is updated
          setTimeout(() => {
            renderPositionChart(playersData);
          }, 50);
        }
      });
    });
  }

  // Load JSON data
  async function loadData() {
    const [playersRes, matchesRes] = await Promise.all([
      fetch('data/players.json'),
      fetch('data/matches.json')
    ]);
    
    const playersJson = await playersRes.json();
    const matchesJson = await matchesRes.json();
    
    return {
      players: playersJson.players,
      matches: matchesJson.matches
    };
  }

  // Get new matches from localStorage (matches added via form)
  function getStoredMatches() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load stored matches:', e);
      return [];
    }
  }

  // Save new matches to localStorage
  function saveMatchesToStorage(matches) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    } catch (e) {
      console.error('Failed to save matches:', e);
    }
  }

  // Get edited seed matches from localStorage
  function getEditedMatches() {
    try {
      const stored = localStorage.getItem(EDITED_MATCHES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Failed to load edited matches:', e);
      return {};
    }
  }

  // Save edited seed matches to localStorage
  function saveEditedMatches(edits) {
    try {
      localStorage.setItem(EDITED_MATCHES_KEY, JSON.stringify(edits));
    } catch (e) {
      console.error('Failed to save edited matches:', e);
    }
  }

  // Get deleted seed match IDs from localStorage
  function getDeletedMatchIds() {
    try {
      const stored = localStorage.getItem(DELETED_MATCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load deleted match IDs:', e);
      return [];
    }
  }

  // Save deleted seed match IDs to localStorage
  function saveDeletedMatchIds(ids) {
    try {
      localStorage.setItem(DELETED_MATCHES_KEY, JSON.stringify(ids));
    } catch (e) {
      console.error('Failed to save deleted match IDs:', e);
    }
  }

  // Check if a match is from seed data
  function isSeedMatch(matchId) {
    return seedMatches.some(m => m.id === matchId);
  }

  // Build allMatches from seed + localStorage (with edits and deletions applied)
  function buildAllMatches() {
    const storedMatches = getStoredMatches();
    const editedMatches = getEditedMatches();
    const deletedIds = getDeletedMatchIds();
    
    // Apply edits to seed matches and filter deleted ones
    const processedSeedMatches = seedMatches
      .filter(m => !deletedIds.includes(m.id))
      .map(m => {
        if (editedMatches[m.id]) {
          return { ...m, ...editedMatches[m.id] };
        }
        return m;
      });
    
    // Combine with stored matches (new matches added via form)
    allMatches = [...processedSeedMatches, ...storedMatches];
    
    // Sort by date (newest first)
    allMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // Calculate player form (last 3 results)
  function calculateForm(playerId, matches) {
    // Get matches for this player, sorted by date (newest first)
    const playerMatches = matches
      .filter(m => m.player1Id === playerId || m.player2Id === playerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    
    // Build form array (oldest to newest for display, most recent on right)
    const form = playerMatches.reverse().map(match => {
      const isPlayer1 = match.player1Id === playerId;
      const playerLegs = isPlayer1 ? match.player1Legs : match.player2Legs;
      return playerLegs === 3 ? 'W' : 'L';
    });
    
    // Pad with empty slots if less than 3 matches
    while (form.length < 3) {
      form.unshift('-');
    }
    
    return form;
  }

  // Calculate historical positions for the chart
  function calculatePositionHistory(players, matches) {
    if (matches.length === 0) return { weeks: [], positions: {} };
    
    // Sort matches by date
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Group matches by week (date)
    const weekGroups = {};
    sortedMatches.forEach(match => {
      const weekKey = match.date;
      if (!weekGroups[weekKey]) {
        weekGroups[weekKey] = [];
      }
      weekGroups[weekKey].push(match);
    });
    
    const weeks = Object.keys(weekGroups).sort();
    const positions = {};
    
    // Initialize positions for all players
    players.forEach(p => {
      positions[p.id] = [];
    });
    
    // Calculate positions after each week
    let cumulativeMatches = [];
    weeks.forEach(week => {
      cumulativeMatches = [...cumulativeMatches, ...weekGroups[week]];
      const standings = calculateStandings(players, cumulativeMatches);
      
      standings.forEach((player, index) => {
        positions[player.id].push(index + 1);
      });
    });
    
    // Format week labels
    const weekLabels = weeks.map(dateStr => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });
    
    return { weeks: weekLabels, positions };
  }

  // Calculate head-to-head records
  function calculateH2H(players, matches) {
    const h2h = {};
    
    // Initialize H2H for all player pairs
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
    
    // Count wins from matches
    matches.forEach(match => {
      const p1 = match.player1Id;
      const p2 = match.player2Id;
      
      // Find the key (sorted order)
      let key = `${p1}-${p2}`;
      let swapped = false;
      if (!h2h[key]) {
        key = `${p2}-${p1}`;
        swapped = true;
      }
      
      if (!h2h[key]) return;
      
      const p1Won = match.player1Legs === 3;
      
      if (swapped) {
        if (p1Won) {
          h2h[key].p2Wins++;
        } else {
          h2h[key].p1Wins++;
        }
      } else {
        if (p1Won) {
          h2h[key].p1Wins++;
        } else {
          h2h[key].p2Wins++;
        }
      }
    });
    
    return Object.values(h2h);
  }

  // Render position chart
  function renderPositionChart(players) {
    const canvas = document.getElementById('position-chart');
    if (!canvas) {
      console.warn('Position chart canvas not found');
      return;
    }
    
    // Get or create empty state element
    const chartContainer = canvas.parentElement;
    let emptyState = chartContainer.querySelector('.chart-empty-state');
    if (!emptyState) {
      emptyState = document.createElement('p');
      emptyState.className = 'empty-state chart-empty-state';
      emptyState.textContent = 'No matches played yet';
      chartContainer.appendChild(emptyState);
    }
    
    // Check if we have valid data
    if (!players || players.length === 0) {
      console.warn('No players data for position chart');
      canvas.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    if (!allMatches || allMatches.length === 0) {
      console.warn('No matches data for position chart');
      canvas.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    const { weeks, positions } = calculatePositionHistory(players, allMatches);
    
    if (!weeks || weeks.length === 0) {
      console.warn('No weeks data for position chart');
      canvas.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    // Show canvas, hide empty state
    canvas.style.display = 'block';
    emptyState.style.display = 'none';
    
    // Get current theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#a0a0a0' : '#6c757d';
    
    const datasets = players.map(player => ({
      label: player.name,
      data: positions[player.id] || [],
      borderColor: PLAYER_COLORS[player.id]?.border || '#888',
      backgroundColor: PLAYER_COLORS[player.id]?.bg || '#888',
      borderWidth: 3,
      tension: 0.1,
      pointRadius: 6,
      pointHoverRadius: 8
    }));
    
    // Destroy existing chart if it exists
    if (positionChart) {
      positionChart.destroy();
      positionChart = null;
    }
    
    try {
      positionChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: weeks,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              reverse: true,  // Position 1 at top
              min: 1,
              max: 4,
              ticks: {
                stepSize: 1,
                callback: function(value) {
                  const positions = ['', '1st', '2nd', '3rd', '4th'];
                  return positions[value] || value;
                },
                color: textColor
              },
              grid: {
                color: gridColor
              }
            },
            x: {
              ticks: {
                color: textColor
              },
              grid: {
                color: gridColor
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                usePointStyle: true,
                padding: 20
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const pos = context.raw;
                  const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
                  return `${context.dataset.label}: ${pos}${suffix}`;
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

  // Render head-to-head records
  function renderH2H(players) {
    const container = document.getElementById('h2h-grid');
    if (!container) return;
    
    const h2hData = calculateH2H(players, allMatches);
    
    if (allMatches.length === 0) {
      container.innerHTML = '<p class="empty-state">No matches played yet</p>';
      return;
    }
    
    container.innerHTML = h2hData.map(record => {
      const total = record.p1Wins + record.p2Wins;
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

  // Render stats section
  function renderStats() {
    renderPositionChart(playersData);
    renderH2H(playersData);
  }

  // Calculate standings from matches
  function calculateStandings(players, matches) {
    // Initialize stats for each player
    const stats = {};
    players.forEach(player => {
      stats[player.id] = {
        id: player.id,
        name: player.name,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        legsFor: 0,
        legsAgainst: 0,
        legDiff: 0,
        highCheckout: 0,
        highVisit: 0,
        bonusCheckouts: 0,
        bonusVisits: 0
      };
    });

    // Process each match
    matches.forEach(match => {
      const p1 = stats[match.player1Id];
      const p2 = stats[match.player2Id];
      
      if (!p1 || !p2) return;

      // Played
      p1.played++;
      p2.played++;

      // Legs
      p1.legsFor += match.player1Legs;
      p1.legsAgainst += match.player2Legs;
      p2.legsFor += match.player2Legs;
      p2.legsAgainst += match.player1Legs;

      // Win/Loss (first to 3 legs wins)
      if (match.player1Legs === 3) {
        p1.won++;
        p2.lost++;
      } else if (match.player2Legs === 3) {
        p2.won++;
        p1.lost++;
      }

      // High checkout tracking
      if (match.player1HighCheckout && match.player1HighCheckout > p1.highCheckout) {
        p1.highCheckout = match.player1HighCheckout;
      }
      if (match.player2HighCheckout && match.player2HighCheckout > p2.highCheckout) {
        p2.highCheckout = match.player2HighCheckout;
      }

      // High visit tracking
      if (match.player1HighVisit && match.player1HighVisit > p1.highVisit) {
        p1.highVisit = match.player1HighVisit;
      }
      if (match.player2HighVisit && match.player2HighVisit > p2.highVisit) {
        p2.highVisit = match.player2HighVisit;
      }

      // Bonus points for 50+ checkouts
      if (match.player1HighCheckout && match.player1HighCheckout >= 50) {
        p1.bonusCheckouts++;
      }
      if (match.player2HighCheckout && match.player2HighCheckout >= 50) {
        p2.bonusCheckouts++;
      }

      // Bonus points for 150+ visits
      if (match.player1HighVisit && match.player1HighVisit >= 150) {
        p1.bonusVisits++;
      }
      if (match.player2HighVisit && match.player2HighVisit >= 150) {
        p2.bonusVisits++;
      }
    });

    // Calculate final stats
    const standings = Object.values(stats).map(player => {
      player.legDiff = player.legsFor - player.legsAgainst;
      // Points = (wins × 3) + bonus checkouts + bonus visits
      player.points = (player.won * 3) + player.bonusCheckouts + player.bonusVisits;
      return player;
    });

    // Sort by points desc, then leg diff desc
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.legDiff - a.legDiff;
    });

    return standings;
  }

  // Calculate points awarded for a match
  function calculateMatchPoints(match) {
    let p1Points = 0;
    let p2Points = 0;
    
    // Winner gets 3 points
    if (match.player1Legs === 3) {
      p1Points += 3;
    } else if (match.player2Legs === 3) {
      p2Points += 3;
    }
    
    // Bonus for 50+ checkout
    if (match.player1HighCheckout && match.player1HighCheckout >= 50) {
      p1Points += 1;
    }
    if (match.player2HighCheckout && match.player2HighCheckout >= 50) {
      p2Points += 1;
    }
    
    // Bonus for 150+ visit
    if (match.player1HighVisit && match.player1HighVisit >= 150) {
      p1Points += 1;
    }
    if (match.player2HighVisit && match.player2HighVisit >= 150) {
      p2Points += 1;
    }
    
    return { p1Points, p2Points };
  }

  // Render standings table
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
      
      // Calculate form for this player
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

  // Get player name by ID
  function getPlayerName(playerId) {
    const player = playersData.find(p => p.id === playerId);
    return player ? player.name : playerId;
  }

  // Render match history
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
      
      // Build stats string
      const stats = [];
      if (match.player1HighCheckout) stats.push(`${p1Name} HC: ${match.player1HighCheckout}`);
      if (match.player2HighCheckout) stats.push(`${p2Name} HC: ${match.player2HighCheckout}`);
      if (match.player1HighVisit) stats.push(`${p1Name} HV: ${match.player1HighVisit}`);
      if (match.player2HighVisit) stats.push(`${p2Name} HV: ${match.player2HighVisit}`);
      const statsStr = stats.length > 0 ? stats.join(', ') : '-';
      
      // Format date
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

  // Refresh all displays
  function refreshDisplays() {
    buildAllMatches();
    const standings = calculateStandings(playersData, allMatches);
    renderStandings(standings);
    renderHistory();
    renderFixtures();
    renderStats();
  }

  // Switch to a specific tab
  function switchToTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Update buttons
    tabBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });
    
    // Update content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabName}-section`) {
        content.classList.add('active');
      }
    });
    
    // Re-render chart when Stats tab becomes visible
    if (tabName === 'stats' && playersData.length > 0) {
      setTimeout(() => {
        renderPositionChart(playersData);
      }, 50);
    }
  }

  // Handle edit button click
  function handleEditClick(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    editingMatchId = matchId;
    
    // Update form UI
    document.getElementById('form-title').textContent = 'Edit Match Result';
    document.getElementById('form-submit-btn').textContent = 'Update Match';
    document.getElementById('form-cancel-btn').hidden = false;
    
    // Populate form with match data
    const form = document.getElementById('match-form');
    form.player1.value = match.player1Id;
    form.player2.value = match.player2Id;
    form.player1Legs.value = match.player1Legs;
    form.player2Legs.value = match.player2Legs;
    form.player1HighCheckout.value = match.player1HighCheckout || '';
    form.player2HighCheckout.value = match.player2HighCheckout || '';
    form.player1HighVisit.value = match.player1HighVisit || '';
    form.player2HighVisit.value = match.player2HighVisit || '';
    
    // Switch to Add Result tab
    switchToTab('add-result');
    
    // Scroll to form
    document.querySelector('.match-form-section').scrollIntoView({ behavior: 'smooth' });
  }

  // Handle cancel edit
  function handleCancelEdit() {
    editingMatchId = null;
    
    // Reset form UI
    document.getElementById('form-title').textContent = 'Add Match Result';
    document.getElementById('form-submit-btn').textContent = 'Add Match';
    document.getElementById('form-cancel-btn').hidden = true;
    
    // Reset form
    document.getElementById('match-form').reset();
    
    // Hide any messages
    document.getElementById('form-message').hidden = true;
  }

  // Show confirmation dialog
  function showConfirmDialog(message, onConfirm) {
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-dialog-content">
        <h3>Confirm Delete</h3>
        <p>${message}</p>
        <div class="confirm-dialog-actions">
          <button class="btn-dialog-cancel">Cancel</button>
          <button class="btn-confirm">Delete</button>
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
    
    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    });
  }

  // Handle delete button click
  function handleDeleteClick(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    const p1Name = getPlayerName(match.player1Id);
    const p2Name = getPlayerName(match.player2Id);
    
    showConfirmDialog(
      `Are you sure you want to delete the match between ${p1Name} and ${p2Name} (${match.player1Legs}-${match.player2Legs})?`,
      () => deleteMatch(matchId)
    );
  }

  // Delete a match
  function deleteMatch(matchId) {
    if (isSeedMatch(matchId)) {
      // Add to deleted IDs list
      const deletedIds = getDeletedMatchIds();
      if (!deletedIds.includes(matchId)) {
        deletedIds.push(matchId);
        saveDeletedMatchIds(deletedIds);
      }
      
      // Also remove any edits for this match
      const editedMatches = getEditedMatches();
      if (editedMatches[matchId]) {
        delete editedMatches[matchId];
        saveEditedMatches(editedMatches);
      }
    } else {
      // Remove from stored matches
      const storedMatches = getStoredMatches();
      const updatedMatches = storedMatches.filter(m => m.id !== matchId);
      saveMatchesToStorage(updatedMatches);
    }
    
    // If we were editing this match, cancel
    if (editingMatchId === matchId) {
      handleCancelEdit();
    }
    
    // Refresh displays
    refreshDisplays();
    
    showFormMessage('Match deleted successfully');
  }

  // Populate player dropdowns
  function populatePlayerDropdowns(players) {
    const player1Select = document.getElementById('player1');
    const player2Select = document.getElementById('player2');
    
    const options = players.map(p => 
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
    
    player1Select.innerHTML = '<option value="">Select player...</option>' + options;
    player2Select.innerHTML = '<option value="">Select player...</option>' + options;
  }

  // Show form message
  function showFormMessage(message, type = 'success') {
    const msgEl = document.getElementById('form-message');
    msgEl.textContent = message;
    msgEl.className = `form-message ${type}`;
    msgEl.hidden = false;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      msgEl.hidden = true;
    }, 5000);
  }

  // Validate match form
  function validateMatchForm(formData) {
    const errors = [];
    
    // Both players must be selected
    if (!formData.player1Id) {
      errors.push('Please select Player 1');
    }
    if (!formData.player2Id) {
      errors.push('Please select Player 2');
    }
    
    // Players can't be the same
    if (formData.player1Id && formData.player2Id && formData.player1Id === formData.player2Id) {
      errors.push('Players cannot be the same');
    }
    
    // Validate legs
    const p1Legs = formData.player1Legs;
    const p2Legs = formData.player2Legs;
    
    if (p1Legs < 0 || p1Legs > 3 || p2Legs < 0 || p2Legs > 3) {
      errors.push('Legs must be between 0 and 3');
    }
    
    // One player must have exactly 3 legs (winner)
    if (p1Legs !== 3 && p2Legs !== 3) {
      errors.push('One player must have 3 legs (the winner)');
    }
    
    // Both players can't have 3 legs
    if (p1Legs === 3 && p2Legs === 3) {
      errors.push('Only one player can have 3 legs');
    }
    
    return errors;
  }

  // Handle form submission
  function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    
    // Build form data
    const formData = {
      player1Id: form.player1.value,
      player2Id: form.player2.value,
      player1Legs: parseInt(form.player1Legs.value, 10),
      player2Legs: parseInt(form.player2Legs.value, 10),
      player1HighCheckout: form.player1HighCheckout.value ? parseInt(form.player1HighCheckout.value, 10) : null,
      player2HighCheckout: form.player2HighCheckout.value ? parseInt(form.player2HighCheckout.value, 10) : null,
      player1HighVisit: form.player1HighVisit.value ? parseInt(form.player1HighVisit.value, 10) : null,
      player2HighVisit: form.player2HighVisit.value ? parseInt(form.player2HighVisit.value, 10) : null
    };
    
    // Validate
    const errors = validateMatchForm(formData);
    if (errors.length > 0) {
      showFormMessage(errors.join('. '), 'error');
      return;
    }
    
    if (editingMatchId !== null) {
      // Update existing match
      updateMatch(editingMatchId, formData);
    } else {
      // Add new match
      addNewMatch(formData);
    }
    
    // Reset form
    form.reset();
    handleCancelEdit();
  }

  // Add a new match
  function addNewMatch(formData) {
    const storedMatches = getStoredMatches();
    
    // Get max ID across all matches
    const allIds = [
      ...seedMatches.map(m => m.id),
      ...storedMatches.map(m => m.id)
    ];
    const maxId = Math.max(...allIds, 0);
    
    const match = {
      id: maxId + 1,
      date: new Date().toISOString().split('T')[0],
      ...formData
    };
    
    // Add to stored matches
    storedMatches.push(match);
    saveMatchesToStorage(storedMatches);
    
    // Refresh displays
    refreshDisplays();
    
    // Show success message
    const p1Name = getPlayerName(match.player1Id);
    const p2Name = getPlayerName(match.player2Id);
    showFormMessage(`Match added: ${p1Name} ${match.player1Legs} - ${match.player2Legs} ${p2Name}`);
  }

  // Update an existing match
  function updateMatch(matchId, formData) {
    if (isSeedMatch(matchId)) {
      // Store the edit in localStorage
      const editedMatches = getEditedMatches();
      editedMatches[matchId] = formData;
      saveEditedMatches(editedMatches);
    } else {
      // Update in stored matches
      const storedMatches = getStoredMatches();
      const matchIndex = storedMatches.findIndex(m => m.id === matchId);
      if (matchIndex !== -1) {
        storedMatches[matchIndex] = {
          ...storedMatches[matchIndex],
          ...formData
        };
        saveMatchesToStorage(storedMatches);
      }
    }
    
    // Refresh displays
    refreshDisplays();
    
    // Show success message
    const p1Name = getPlayerName(formData.player1Id);
    const p2Name = getPlayerName(formData.player2Id);
    showFormMessage(`Match updated: ${p1Name} ${formData.player1Legs} - ${formData.player2Legs} ${p2Name}`);
  }

  // ===== FIXTURES LOGIC =====

  // Generate all possible match pairs for round robin
  function generateRoundRobinPairs(players) {
    const pairs = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        pairs.push([players[i].id, players[j].id]);
      }
    }
    return pairs;
  }

  // Check if a match between two players exists in matches array
  function matchExists(matches, player1Id, player2Id) {
    return matches.some(m => 
      (m.player1Id === player1Id && m.player2Id === player2Id) ||
      (m.player1Id === player2Id && m.player2Id === player1Id)
    );
  }

  // Get head-to-head record between two players
  function getHeadToHead(matches, player1Id, player2Id) {
    let p1Wins = 0;
    let p2Wins = 0;
    
    matches.forEach(m => {
      if ((m.player1Id === player1Id && m.player2Id === player2Id)) {
        if (m.player1Legs === 3) p1Wins++;
        else if (m.player2Legs === 3) p2Wins++;
      } else if ((m.player1Id === player2Id && m.player2Id === player1Id)) {
        if (m.player1Legs === 3) p2Wins++;
        else if (m.player2Legs === 3) p1Wins++;
      }
    });
    
    return { p1Wins, p2Wins, total: p1Wins + p2Wins };
  }

  // Get remaining matches in current round
  function getRemainingCurrentRound(players, matches) {
    const allPairs = generateRoundRobinPairs(players);
    const remaining = [];
    
    // Count how many matches each pair has played
    const pairCounts = {};
    allPairs.forEach(([p1, p2]) => {
      const key = [p1, p2].sort().join('-');
      pairCounts[key] = 0;
    });
    
    // Count completed matches for each pair
    matches.forEach(m => {
      const key = [m.player1Id, m.player2Id].sort().join('-');
      if (pairCounts[key] !== undefined) {
        pairCounts[key]++;
      }
    });
    
    // Find the minimum matches played (current round number - 1)
    const minMatches = Math.min(...Object.values(pairCounts));
    
    // Find pairs that haven't played in current round yet
    allPairs.forEach(([p1, p2]) => {
      const key = [p1, p2].sort().join('-');
      if (pairCounts[key] === minMatches) {
        remaining.push([p1, p2]);
      }
    });
    
    return remaining;
  }

  // Generate fixture schedule
  function generateFixtureSchedule(players, matches) {
    const schedule = [];
    
    // Get remaining matches in current round
    const remainingCurrent = getRemainingCurrentRound(players, matches);
    
    // This week - remaining current round matches
    if (remainingCurrent.length > 0) {
      schedule.push({
        title: 'This Week',
        date: '26 Jan',
        badge: 'current',
        matches: remainingCurrent.slice(0, 2)
      });
      
      // If more than 2 remaining in current round, add them to next week
      if (remainingCurrent.length > 2) {
        schedule.push({
          title: 'Week of 2 Feb',
          date: '2 Feb',
          badge: null,
          matches: remainingCurrent.slice(2, 4)
        });
      }
    }
    
    // Next round - generate full round robin
    const allPairs = generateRoundRobinPairs(players);
    
    // Determine when next round starts based on remaining current
    let nextRoundWeeks;
    if (remainingCurrent.length <= 2) {
      nextRoundWeeks = [
        { title: 'Week of 2 Feb', date: '2 Feb' },
        { title: 'Week of 9 Feb', date: '9 Feb' },
        { title: 'Week of 16 Feb', date: '16 Feb' }
      ];
    } else {
      nextRoundWeeks = [
        { title: 'Week of 9 Feb', date: '9 Feb' },
        { title: 'Week of 16 Feb', date: '16 Feb' },
        { title: 'Week of 23 Feb', date: '23 Feb' }
      ];
    }
    
    // Add round divider
    schedule.push({ type: 'divider', label: 'Next Round' });
    
    // Distribute matches across 3 weeks (2 per week)
    for (let i = 0; i < 3; i++) {
      const weekMatches = allPairs.slice(i * 2, i * 2 + 2);
      if (weekMatches.length > 0) {
        schedule.push({
          title: nextRoundWeeks[i].title,
          date: nextRoundWeeks[i].date,
          badge: 'next-round',
          matches: weekMatches
        });
      }
    }
    
    return schedule;
  }

  // Render fixtures
  function renderFixtures() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    
    const schedule = generateFixtureSchedule(playersData, allMatches);
    
    if (schedule.length === 0) {
      container.innerHTML = `
        <div class="fixtures-empty">
          <p>No upcoming fixtures</p>
        </div>
      `;
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
            ${item.badge ? `<span class="fixtures-week-badge ${item.badge}">${item.badge === 'current' ? 'Current Round' : 'Round 2'}</span>` : ''}
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
            <div class="fixture-player player-left">
              ${p1Name}
              ${h2h.total > 0 && h2h.p1Wins > h2h.p2Wins ? '👑' : ''}
            </div>
            <div class="fixture-vs">VS</div>
            <div class="fixture-player player-right">
              ${h2h.total > 0 && h2h.p2Wins > h2h.p1Wins ? '👑' : ''}
              ${p2Name}
            </div>
          </div>
          ${h2hHtml}
        `;
      });
      
      html += '</div>';
    });
    
    container.innerHTML = html;
  }

  // Initialize form
  function initForm() {
    const form = document.getElementById('match-form');
    const cancelBtn = document.getElementById('form-cancel-btn');
    
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
      populatePlayerDropdowns(playersData);
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleCancelEdit);
    }
  }

  // Initialize app
  async function init() {
    initTheme();
    initTabs();
    
    // Check data version and clear old localStorage if needed
    checkDataVersion();
    
    const tbody = document.querySelector('#standings-table tbody');
    tbody.innerHTML = '<tr><td colspan="12" class="loading">Loading...</td></tr>';

    try {
      const { players, matches } = await loadData();
      playersData = players;
      seedMatches = matches;
      
      // Build all matches (with edits/deletions applied)
      buildAllMatches();
      
      const standings = calculateStandings(playersData, allMatches);
      renderStandings(standings);
      renderHistory();
      renderFixtures();
      renderStats();
      
      // Initialize the match form
      initForm();
    } catch (error) {
      console.error('Failed to load data:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-state">
            <p>Failed to load standings</p>
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
