// Darts League App

(function() {
  'use strict';

  const STORAGE_KEY = 'dartsLeague_matches';
  const EDITED_MATCHES_KEY = 'dartsLeague_editedMatches';
  const DELETED_MATCHES_KEY = 'dartsLeague_deletedMatchIds';
  
  let playersData = [];
  let seedMatches = [];
  let allMatches = [];
  let editingMatchId = null;

  // Theme management
  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
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
          <td colspan="10" class="empty-state">
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
      
      return `
        <tr>
          <td class="col-rank ${rankClass}">${rank}</td>
          <td class="col-player">${player.name}</td>
          <td class="col-num">${player.played}</td>
          <td class="col-num">${player.won}</td>
          <td class="col-num">${player.lost}</td>
          <td class="col-num highlight">${player.points}</td>
          <td class="col-num hide-mobile">${player.legsFor}</td>
          <td class="col-num hide-mobile">${player.legsAgainst}</td>
          <td class="col-num">${legDiffDisplay}</td>
          <td class="col-num hide-mobile">${highCheckout}</td>
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

  // Refresh both displays
  function refreshDisplays() {
    buildAllMatches();
    const standings = calculateStandings(playersData, allMatches);
    renderStandings(standings);
    renderHistory();
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
    
    const tbody = document.querySelector('#standings-table tbody');
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';

    try {
      const { players, matches } = await loadData();
      playersData = players;
      seedMatches = matches;
      
      // Build all matches (with edits/deletions applied)
      buildAllMatches();
      
      const standings = calculateStandings(playersData, allMatches);
      renderStandings(standings);
      renderHistory();
      
      // Initialize the match form
      initForm();
    } catch (error) {
      console.error('Failed to load data:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state">
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
