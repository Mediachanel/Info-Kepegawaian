import EmptyState from "@/components/ui/EmptyState";

export default function DataTable({ columns, data, rowKey = "id", actions, startNumber = 1, showNumber = false }) {
  if (!data?.length) return <EmptyState />;

  return (
    <section className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {showNumber ? <th className="table-th w-16 text-center" scope="col">No</th> : null}
              {columns.map((column) => (
                <th key={column.key} className={`table-th ${column.headerClassName || ""}`.trim()} scope="col">{column.header}</th>
              ))}
              {actions ? <th className="table-th text-center" scope="col">Aksi</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((item, index) => (
              <tr key={item[rowKey]} className="hover:bg-dinkes-50/40">
                {showNumber ? <td className="table-td text-center">{startNumber + index}</td> : null}
                {columns.map((column) => (
                  <td key={column.key} className={`table-td ${column.cellClassName || ""}`.trim()}>{column.render ? column.render(item, index) : item[column.key]}</td>
                ))}
                {actions ? <td className="table-td text-center">{actions(item)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
