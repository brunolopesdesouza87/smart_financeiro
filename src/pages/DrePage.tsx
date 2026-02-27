import React, { useState } from 'react';
import { Card, Table, DatePicker, Button, Switch, Select, message } from 'antd';
import { FileText, FileSpreadsheet, BarChart2 } from 'lucide-react';
import dayjs from 'dayjs';

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: dayjs().month(i).format('MMMM') }));
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const year = dayjs().year() - i;
  return { value: year, label: String(year) };
});

const DrePage: React.FC = () => {
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(dayjs().year());
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dreData, setDreData] = useState<any[]>([]);
  const [dreDataPrev, setDreDataPrev] = useState<any[]>([]);

  // TODO: Buscar dados da DRE via Supabase fn_get_dre

  const handleExport = (type: 'pdf' | 'excel') => {
    message.info(`Exportação para ${type.toUpperCase()} em breve.`);
  };

  return (
    <div className="dre-page">
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={month}
            onChange={setMonth}
            options={monthOptions}
            style={{ width: 140 }}
          />
          <Select
            value={year}
            onChange={setYear}
            options={yearOptions}
            style={{ width: 110 }}
          />
          <Switch
            checked={compare}
            onChange={setCompare}
            checkedChildren="Comparar mês anterior"
            unCheckedChildren="Comparar mês anterior"
            style={{ minWidth: 180 }}
          />
          <Button icon={<FileText size={16} />} onClick={() => handleExport('pdf')}>Exportar PDF</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => handleExport('excel')}>Exportar Excel</Button>
        </div>
      </Card>
      <Card>
        {/* TODO: Tabela DRE vertical profissional com formatação, % e comparação */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <BarChart2 size={20} style={{ marginRight: 8 }} />
          <b>Demonstração do Resultado do Exercício (DRE)</b>
        </div>
        {/* Tabela placeholder */}
        <Table
          dataSource={dreData}
          columns={[]}
          pagination={false}
          bordered
          summary={() => null}
        />
      </Card>
    </div>
  );
};

export default DrePage;
