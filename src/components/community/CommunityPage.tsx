import React, { useState } from 'react';
import { AlertTriangle, ChevronRight, FileText, HeartHandshake, MapPin, Plus, ShieldCheck, Star } from 'lucide-react';
import type { IncidentReport } from '../../types/models';
import { BackHeader } from '../layout/BackHeader';
import { CommunityGuidelines, ReportComposer } from './CommunityGuidelines';
import { configuredClient } from '../../services/safetyService';
import { getCurrentSession } from '../../services/authService';

interface CommunityPageProps {
  nav: (page: string) => void;
}

export const CommunityPage: React.FC<CommunityPageProps> = ({ nav }) => {
  const [composer, setComposer] = useState(false);
  const [guidelines, setGuidelines] = useState(false);
  const [reports, setReports] = useState<any[]>([]);


  const fetchReports = async () => {
    const { data } = await configuredClient()
      .from('incident_reports')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: false });
    
    if (data) {
      setReports(data.map((r: any) => ({
        id: r.id,
        place: r.place,
        text: r.description,
        rating: r.rating,
        anonymous: r.anonymous,
        time: new Date(r.created_at).toLocaleDateString(),
        status: r.status,
        userName: r.profiles?.display_name || 'Anonymous member'
      })));
    }
  };

  React.useEffect(() => {
    fetchReports();
  }, []);

  const submitReport = async (report: Partial<IncidentReport>) => {
    const session = await getCurrentSession();
    if (!session?.user) return;
    
    const { error } = await configuredClient().from('incident_reports').insert({
      user_id: session.user.id,
      place: report.place || 'Unknown',
      description: report.text || '',
      rating: report.rating || 'Unsafe',
      anonymous: Boolean(report.anonymous),
      status: 'pending'
    });

    if (!error) {
      await fetchReports();
      setComposer(false);
    }
  };

  return (
    <section className="screen community-screen">
      <BackHeader
        title="Community"
        nav={nav}
        extra={
          <button className="round-add" onClick={() => setComposer(true)} aria-label="Add report">
            <Plus size={20} />
          </button>
        }
      />
      <div className="community-hero">
        <span>
          <HeartHandshake size={26} />
        </span>
        <div>
          <b>Safer, together.</b>
          <p>Share what you see to help your community stay informed.</p>
        </div>
      </div>

      <button className="guidelines-link" onClick={() => setGuidelines(true)}>
        <FileText size={16} /> Community reporting guidelines <ChevronRight size={16} />
      </button>

      <div className="report-feed">
          {reports.map((report) => (
            <article className="report-card" key={report.id}>
              <div className="report-top">
                <span className={`report-badge ${report.rating.toLowerCase()}`}>
                  {report.rating === 'Safe' ? (
                    <ShieldCheck size={15} />
                  ) : (
                    <AlertTriangle size={15} />
                  )}{' '}
                  {report.rating}
                </span>
                <small>{report.time}</small>
              </div>
              <h3>
                <MapPin size={15} />
                {report.place}
              </h3>
              <p>{report.text}</p>
              <footer>
                <span>{report.anonymous ? 'Anonymous member' : report.userName}</span>
                <b>{report.status}</b>
              </footer>
            </article>
          ))}
        </div>

      {composer && (
        <ReportComposer close={() => setComposer(false)} submit={submitReport} />
      )}
      {guidelines && <CommunityGuidelines close={() => setGuidelines(false)} />}
    </section>
  );
};
