// Darts League App

(function() {
  'use strict';

  const STORAGE_KEY = 'dartsLeague_matches';
  let playersData = [];
  let allMatches = [];

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

  // Get matches from localStorage
  function getStoredMatches() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load stored matches:', e);
      return [];
    }
  }

  // Save matches to localStorage
  function saveMatchesToStorage(matches) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    } catch (e) {
      console.error('Failed to save matches:', e);
    }
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

  // Refresh standings display
  function refreshStandings() {
    const standings = calculateStandings(playersData, allMatches);
    renderStandings(standings);
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
    
    // Build match object
    const storedMatches = getStoredMatches();
    const maxId = Math.max(
      ...allMatches.map(m => m.id),
      ...storedMatches.map(m => m.id),
      0
    );
    
    const match = {
      id: maxId + 1,
      date: new Date().toISOString().split('T')[0],
      ...formData
    };
    
    // Add to stored matches
    storedMatches.push(match);
    saveMatchesToStorage(storedMatches);
    
    // Update allMatches and refresh display
    allMatches.push(match);
    refreshStandings();
    
    // Show success message
    const p1Name = playersData.find(p => p.id === match.player1Id)?.name || match.player1Id;
    const p2Name = playersData.find(p => p.id === match.player2Id)?.name || match.player2Id;
    showFormMessage(`Match added: ${p1Name} ${match.player1Legs} - ${match.player2Legs} ${p2Name}`);
    
    // Reset form
    form.reset();
  }

  // Initialize form
  function initForm() {
    const form = document.getElementById('match-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
      populatePlayerDropdowns(playersData);
    }
  }

  // Initialize app
  async function init() {
    initTheme();
    
    const tbody = document.querySelector('#standings-table tbody');
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';

    try {
      const { players, matches } = await loadData();
      playersData = players;
      
      // Merge seed matches with localStorage matches
      const storedMatches = getStoredMatches();
      allMatches = [...matches, ...storedMatches];
      
      const standings = calculateStandings(playersData, allMatches);
      renderStandings(standings);
      
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
