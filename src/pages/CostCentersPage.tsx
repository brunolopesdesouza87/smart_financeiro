import React from 'react';
import { Card, Button, Table, Modal, Form, Input, Row, Col } from 'antd';
import { PlusCircle } from 'lucide-react';

const CostCentersPage: React.FC = () => {
  // TODO: Buscar centros de custo do Supabase
  // TODO: Modal de criação/edição
  return (
    <div className="cost-centers-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><h2>Centros de Custo</h2></Col>
        <Col><Button type="primary" icon={<PlusCircle />}>Novo Centro de Custo</Button></Col>
      </Row>
      <Card>
        <Table dataSource={[]} columns={[]} rowKey="id" />
      </Card>
      {/* TODO: Modal de criação/edição */}
    </div>
  );
};

export default CostCentersPage;
