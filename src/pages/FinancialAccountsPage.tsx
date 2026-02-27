import React from 'react';
import { Card, Button, Table, Modal, Form, Input, Select, Switch, Row, Col } from 'antd';
import { PlusCircle } from 'lucide-react';

const FinancialAccountsPage: React.FC = () => {
  // TODO: Buscar contas do Supabase
  // TODO: Modal de criação/edição
  // TODO: Card visual para cada conta
  return (
    <div className="financial-accounts-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><h2>Contas Bancárias e Financeiras</h2></Col>
        <Col><Button type="primary" icon={<PlusCircle />}>Nova Conta</Button></Col>
      </Row>
      {/* Cards de contas */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* TODO: Mapear contas reais */}
        <Col span={6}><Card title="Conta Exemplo" bordered>Saldo: R$ 0,00</Card></Col>
      </Row>
      {/* Tabela de contas */}
      <Card>
        <Table dataSource={[]} columns={[]} rowKey="id" />
      </Card>
      {/* TODO: Modal de criação/edição */}
    </div>
  );
};

export default FinancialAccountsPage;
