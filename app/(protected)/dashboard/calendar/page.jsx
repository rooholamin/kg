import { PageHeader } from '@/components/custom/page-header';
import { CalendarModule } from './components/calendar-module';

export const metadata = {
  title: 'Editorial calendar',
  description: 'Publish dates, readiness, and social (mock)',
};

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="One module for all calendar-like signals — filters are mock data only."
      />
      <CalendarModule />
    </>
  );
}
