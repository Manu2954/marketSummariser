import Header from '../components/Header';
import ChartPanel from '../components/ChartPanel';
import UploadPanel from '../components/UploadPanel';
import SummaryPanel from '../components/SummaryPanel';
import PreferencesDrawer from '../components/PreferencesDrawer';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl">
      <Header />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <ChartPanel />
          <UploadPanel />
        </div>
        <SummaryPanel />
      </div>
      <PreferencesDrawer />
    </main>
  );
}
