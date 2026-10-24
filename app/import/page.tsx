import { PageHeader } from "../../components/ui";
import ImportWorkspace from "../../components/ImportWorkspace";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Bring in the companies you passed on."
        lede="Connect Affinity and pick the list where you track deals. SecondLook keeps only the passes, with the partner's reason, and leaves your notes inside your fund."
      />
      <ImportWorkspace />
    </>
  );
}
