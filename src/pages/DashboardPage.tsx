import React, { useState } from 'react';
import { Card, Row, Col, Table, Button, Skeleton, Progress, Tag, Tooltip } from 'antd';
import { TrendingUp, TrendingDown, DollarSign, PieChart, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

const DashboardPage: React.FC = () => {
  // TODO: Buscar dados reais via Supabase (Promise.all)
  const loading = false; // TODO: loading real

  // Placeholders para KPIs
  const kpis = [
    { label: 'Saldo Total em Caixa', value: 'R$ 0,00', icon: <DollarSign size={32} color="#1677ff" /> },
    { label: 'Faturamento do Mês', value: 'R$ 0,00', icon: <TrendingUp size={32} color="#52c41a" /> },
    { label: 'Despesas do Mês', value: 'R$ 0,00', icon: <TrendingDown size={32} color="#ff4d4f" /> },
    { label: 'Lucro do Mês', value: 'R$ 0,00', icon: <DollarSign size={32} color="#13c2c2" />, extra: <Tag color="green">Margem 0%</Tag> },
  ];

  // Placeholders para alertas
  const alerts = [
    { type: 'error', icon: '🔴', text: '3 contas vencidas', value: 'R$ 1.200,00' },
    { type: 'warning', icon: '🟠', text: '2 contas vencem hoje', value: 'R$ 800,00' },
    { type: 'info', icon: '🟡', text: '5 contas vencem em 7 dias', value: 'R$ 2.000,00' },
    { type: 'success', icon: '💰', text: 'Saldo baixo em Conta Corrente', value: 'R$ 150,00' },
    { type: 'success', icon: '✅', text: '4 pagamentos recebidos hoje', value: 'R$ 2.500,00' },
  ];

  return (
    <div className="dashboard-page">
      {/* Linha 1: KPIs */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        {kpis.map((kpi, i) => (
          <Col span={6} key={i}>
            <Card className="kpi-card" bordered={false} style={{ minHeight: 120 }}>
              <Row align="middle" gutter={16}>
                <Col>{kpi.icon}</Col>
                <Col flex="auto">
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-value" style={{ fontSize: 28, fontWeight: 700 }}>{kpi.value}</div>
                  {kpi.extra}
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Linha 2: Gráfico + Alertas */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={18}>
          <Card title="Entradas x Saídas + Saldo (30 dias)">
            {/* TODO: Gráfico de barras + linha */}
            <Skeleton active paragraph={{ rows: 6 }} loading={loading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card title="Alertas" className="alert-panel">
            {alerts.map((alert, i) => (
              <div key={i} className={`alert-row alert-${alert.type}`}> <span>{alert.icon}</span> {alert.text} <b style={{ float: 'right' }}>{alert.value}</b> </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Linha 3: Gráficos de pizza */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Receitas por Categoria (Mês)">
            <PieChart size={32} /> {/* TODO: Gráfico real */}
            <Skeleton active paragraph={{ rows: 4 }} loading={loading} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Despesas por Categoria (Mês)">
            <PieChart size={32} /> {/* TODO: Gráfico real */}
            <Skeleton active paragraph={{ rows: 4 }} loading={loading} />
          </Card>
        </Col>
      </Row>

      {/* Linha 4: Atividade recente */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="Atividade Recente" extra={<Button type="link" href="/financeiro/fluxo-de-caixa" icon={<ArrowRight />}>Ver todos</Button>}>
            <Table
              dataSource={[]}
              columns={[]}
              pagination={false}
              rowKey="id"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Linha 5: Contas vencendo */}
      <Row gutter={24}>
        <Col span={12}>
          <Card title="Contas a Pagar Mais Urgentes">
            <Table dataSource={[]} columns={[]} pagination={false} rowKey="id" loading={loading} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Maiores Valores a Receber">
            <Table dataSource={[]} columns={[]} pagination={false} rowKey="id" loading={loading} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
