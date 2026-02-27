import React from 'react';
import { Card, Button, Tree, Row, Col } from 'antd';
import { PlusCircle } from 'lucide-react';

const PlanoDeContasPage: React.FC = () => {
  // TODO: Buscar plano de contas do Supabase
  // TODO: Modal de criação/edição
  // TODO: Drag-and-drop (opcional)
  return (
    <div className="plano-contas-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><h2>Plano de Contas</h2></Col>
        <Col><Button type="primary" icon={<PlusCircle />}>Nova Categoria</Button></Col>
      </Row>
      <Card>
        {/* TODO: Árvore hierárquica real */}
        <Tree
          treeData={[]}
          defaultExpandAll
        />
      </Card>
      {/* TODO: Modal de criação/edição */}
    </div>
  );
};

export default PlanoDeContasPage;
