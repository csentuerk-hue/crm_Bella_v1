type CustomersWorkspaceProps = {
  listPanel: React.ReactNode;
  mainPanel: React.ReactNode;
  infoPanel: React.ReactNode;
};

export function CustomersWorkspace({ listPanel, mainPanel, infoPanel }: CustomersWorkspaceProps) {
  return (
    <section className="overflow-x-auto pb-2" data-testid="customers-crm-layout">
      <div className="grid min-w-[1220px] grid-cols-[320px_minmax(0,1fr)_320px] gap-5">
        {listPanel}
        {mainPanel}
        {infoPanel}
      </div>
    </section>
  );
}
