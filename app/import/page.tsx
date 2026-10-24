import { PageHeader } from "../../components/ui";
import ImportWorkspace from "../../components/ImportWorkspace";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import passed deals"
        lede="From Affinity or any document. Only passes come in, with the partner's reason."
      />
      <ImportWorkspace />
    </>
  );
}
