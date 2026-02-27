import React, { useState } from 'react';
import { Tabs, DatePicker, Switch } from 'antd';
import dayjs from 'dayjs';

// TODO: importar tipos corretos e hooks de dados

const periodTabs = [
  { key: 'week', label: 'Esta Semana' },
  { key: 'month', label: 'Este Mês' },
  { key: '30days', label: 'Próximos 30 dias' },
  { key: 'custom', label: 'Personalizado' },
];

const toggleOptions = [
  { key: 'real', label: 'Realizado' },
  { key: 'proj', label: 'Projetado' },
  { key: 'both', label: 'Ambos' },
];

const CashFlowPage: React.FC = () => {
  // Estado do período
  const [period, setPeriod] = useState<'week'|'month'|'30days'|'custom'>('week');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]|null>(null);

  // Corrige tipo do onChange do RangePicker
  const handleRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setCustomRange([dates[0], dates[1]]);
    } else {
      setCustomRange(null);
    }
  };
  const [toggle, setToggle] = useState<'real'|'proj'|'both'>('real');

  // Modal lançamento manual
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<'in'|'out'>('in');
  const [manualLoading, setManualLoading] = useState(false);
  const [form] = Form.useForm();

  // TODO: hooks para buscar dados de saldo, entradas, saídas, etc.
  // Utilize o supabase client importado

  // TODO: calcular datas do período

  // TODO: preparar dados para cards, gráfico e tabela

  const openManualModal = () => {
    setManualType('in');
    setManualModalOpen(true);
    form.resetFields();
  };

  const handleManualSubmit = async (values: any) => {
    setManualLoading(true);
    try {
      // TODO: chamada à API para inserir lançamento manual
      message.success('Lançamento criado com sucesso!');
      setManualModalOpen(false);
    } catch (e) {
      message.error('Erro ao criar lançamento.');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="cashflow-page">
      {/* Botão Novo Lançamento Manual */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="primary" onClick={openManualModal} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusCircle size={18} /> Novo Lançamento Manual
        </button>
      </div>

      <Modal
        open={manualModalOpen}
        onCancel={() => setManualModalOpen(false)}
        title="Novo Lançamento Manual"
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={manualLoading}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleManualSubmit}
          initialValues={{
            type: 'in',
            date: dayjs().format('YYYY-MM-DD'),
            linkToAccount: false,
          }}
        >
          <Form.Item label="Tipo" name="type" rules={[{ required: true }]}> 
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              onChange={e => setManualType(e.target.value)}
            >
              <Radio.Button value="in" style={{ color: 'green' }}>Entrada</Radio.Button>
              <Radio.Button value="out" style={{ color: 'red' }}>Saída</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="Descrição" name="description" rules={[{ required: true, message: 'Informe a descrição.' }]}> 
            <Input maxLength={80} autoFocus />
          </Form.Item>
          <Form.Item label="Valor" name="amount" rules={[{ required: true, message: 'Informe o valor.' }]}> 
            <Input type="number" min={0.01} step={0.01} prefix="R$" />
          </Form.Item>
          <Form.Item label="Data" name="date" rules={[{ required: true }]}> 
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Conta Bancária" name="account_id" rules={[{ required: true, message: 'Selecione a conta.' }]}> 
            <Select placeholder="Selecione a conta">
              {/* TODO: popular contas bancárias */}
              <Select.Option value="1">Conta Exemplo</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Categoria" name="category_id"> 
            <Select placeholder="Selecione a categoria">
              {/* TODO: popular categorias do plano de contas */}
              <Select.Option value="1">Categoria Exemplo</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Observações" name="notes"> 
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
          <Form.Item name="linkToAccount" valuePropName="checked">
            <Checkbox>Vincular a uma Conta a Pagar/Receber existente</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
      {/* Seletor de período e toggle */}
      <div className="cashflow-period-selector">
        <Tabs
          activeKey={period}
          onChange={key => setPeriod(key as any)}
          items={periodTabs.map(tab => ({ key: tab.key, label: tab.label }))}
        />
        {period === 'custom' && (
          <DatePicker.RangePicker
            value={customRange}
            onChange={handleRangeChange}
            format="DD/MM/YYYY"
            style={{ marginLeft: 16 }}
          />
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {toggleOptions.map(opt => (
            <Switch
              key={opt.key}
              checked={toggle === opt.key}
              onChange={() => setToggle(opt.key as any)}
              checkedChildren={opt.label}
              unCheckedChildren={opt.label}
              style={{ minWidth: 80 }}
            />
          ))}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="cashflow-summary-cards">
        {/* TODO: Cards de saldo atual, entradas, saídas, resultado */}
      </div>

      {/* Gráfico principal */}
      <div className="cashflow-main-chart">
        {/* TODO: Gráfico de barras + linha de saldo */}
      </div>

      {/* Tabela detalhada por dia */}
      <div className="cashflow-daily-table">
        {/* TODO: Tabela detalhada com expansão */}
      </div>

      {/* Cards de saldo por conta bancária */}
      <div className="cashflow-accounts-cards">
        {/* TODO: Cards de saldo por conta */}
      </div>
    </div>
  );
};

export default CashFlowPage;
