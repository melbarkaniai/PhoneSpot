import { useEffect } from 'react';

export default function NoTrack() {
  useEffect(() => {
    localStorage.setItem('ps_no_track', 'true');
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Inter, sans-serif',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1D1D1F' }}>
        Tracking désactivé
      </h1>
      <p style={{ fontSize: '14px', color: '#6E6E73' }}>
        Vos visites ne seront plus comptées dans les statistiques.
      </p>
      <a href="/" style={{
        marginTop: '8px',
        color: '#0071E3',
        fontSize: '14px',
        textDecoration: 'none'
      }}>
        Retour à l'accueil →
      </a>
    </div>
  );
}
