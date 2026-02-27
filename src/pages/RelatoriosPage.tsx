import React, { useState } from 'react';
import React, { useState } from 'react';
import { Card, Tabs, DatePicker } from 'antd';

const { RangePicker } = DatePicker;

const periodOptions = [
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

const RelatoriosPage: React.FC = () => {
  const [tab, setTab] = useState('receitas');
  const [period, setPeriod] = useState('month');
  const [customRange, setCustomRange] = useState<any>(null);

  // TODO: Buscar dados reais via Supabase

  const handleExport = (type: 'pdf' | 'excel') => {
    // TODO: exportação real
    alert(`Exportar ${tab} para ${type.toUpperCase()}`);
  };

  return (
    <div className="relatorios-page">
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Select
              value={period}
              onChange={setPeriod}
              options={periodOptions}
              style={{ width: 160 }}
            />
          </Col>
          {period === 'custom' && (
            <Col>
              <RangePicker
                value={customRange}
                onChange={setCustomRange}
                format="DD/MM/YYYY"
              />
            </Col>
          )}
          <Col>
            <Button icon={<FileText size={16} />} onClick={() => handleExport('pdf')}>Exportar PDF</Button>
          </Col>
          <Col>
            <Button icon={<FileSpreadsheet size={16} />} onClick={() => handleExport('excel')}>Exportar Excel</Button>
          </Col>
        </Row>
      </Card>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[{
          key: 'receitas',
          label: 'Análise de Receitas',
          children: (
            <div>
              {/* Gráficos e KPIs de receitas */}
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}><Card><PieChart /> Pizza receitas por categoria</Card></Col>
                <Col span={10}><Card><BarChart2 /> Barras receita por mês</Card></Col>
                <Col span={8}><Card><TrendingUp /> KPIs: ticket médio, total, maior venda</Card></Col>
              </Row>
              <Card title="Top 10 clientes por valor recebido">
                <Table dataSource={[]} columns={[]} pagination={false} />
              </Card>
            </div>
          )
        }, {
          key: 'despesas',
          label: 'Análise de Despesas',
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}><Card><PieChart /> Pizza despesas por categoria</Card></Col>
                <Col span={10}><Card><BarChart2 /> Barras evolução mensal despesas</Card></Col>
                <Col span={8}><Card><TrendingDown /> KPIs: fixas vs variáveis</Card></Col>
              </Row>
              <Card title="Despesas por fornecedor">
                <Table dataSource={[]} columns={[]} pagination={false} />
              </Card>
            </div>
          )
        }, {
          key: 'inadimplencia',
          label: 'Inadimplência',
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}><Card><Users /> Total contas vencidas</Card></Col>
                <Col span={10}><Card><BarChart2 /> Gráfico evolução inadimplência</Card></Col>
                <Col span={8}><Card><Percent /> KPIs aging report</Card></Col>
              </Row>
              <Card title="Aging report">
                <Table dataSource={[]} columns={[]} pagination={false} />
              </Card>
              <Card title="Lista detalhada dos inadimplentes">
                <Table dataSource={[]} columns={[]} pagination={false} />
              </Card>
            </div>
          )
        }, {
          key: 'cmv',
          label: 'CMV e Margem',
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}><Card><TrendingDown /> CMV do período</Card></Col>
                <Col span={6}><Card><TrendingUp /> Receita Bruta</Card></Col>
                <Col span={6}><Card><Percent /> Margem Bruta</Card></Col>
                <Col span={6}><Card><BarChart2 /> Gráfico evolução margem</Card></Col>
              </Row>
              <Card title="Margem por categoria de produto">
                <Table dataSource={[]} columns={[]} pagination={false} />
              </Card>
            </div>
          )
        }]}
      />
    </div>
  );
};

export default RelatoriosPage;
