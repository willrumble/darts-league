// Darts League App

(function() {
  'use strict';

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
    
    const playersData = await playersRes.json();
    const matchesData = await matchesRes.json();
    
    return {
      players: playersData.players,
      matches: matchesData.matches
    };
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

  // Initialize app
  async function init() {
    initTheme();
    
    const tbody = document.querySelector('#standings-table tbody');
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';

    try {
      const { players, matches } = await loadData();
      const standings = calculateStandings(players, matches);
      renderStandings(standings);
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
