import { Button as AppButton } from '@/components/ui/button';
import { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import type { StaffOrder } from '@/hooks/useStaff';
import { snapshotText } from '@/lib/cash-checkout';
import { formatMoney } from '@/lib/cash-orders';
import { parseCashMinor, type StaffAction, type StaffCommand } from '@/lib/staff-commands';
import { staffError, type BranchStaff } from '@/lib/staff-orders';

interface Props {
  orders: StaffOrder[]; isLoading: boolean; actor: string; isAdmin: boolean; roster: BranchStaff[];
  blocked: boolean; onCommand(command: StaffCommand): Promise<unknown>;
}
function Action({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  const caution = /cancel|refund|correct mistaken/i.test(label);
  return <AppButton disabled={disabled} onPress={onPress} variant={caution ? 'outline' : 'default'} textClassName={caution ? 'text-red-700' : undefined} className="my-1">{label}</AppButton>;
}
function Field({ label, value, onChange, numeric = false }: { label: string; value: string; onChange(value: string): void; numeric?: boolean }) {
  return <View className="my-2"><Text className="text-slate-700 mb-1">{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'}
      autoCapitalize="none" maxLength={numeric ? 12 : 500} className="border border-slate-300 bg-white rounded-lg p-3 text-ink" /></View>;
}
function Confirm({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} className="py-3 flex-row">
    <Text className="font-bold mr-3">{value ? '☑' : '☐'}</Text><Text className="flex-1">{label}</Text>
  </TouchableOpacity>;
}
function OrderCard({ order, actor, isAdmin, roster, blocked, onCommand }: Omit<Props, 'orders' | 'isLoading'> & { order: StaffOrder }) {
  const [panel, setPanel] = useState<StaffAction | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [tender, setTender] = useState('');
  const [person, setPerson] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const receipt = order.receipt;
  const currency = order.currency ?? 'Currency unconfirmed';
  const money = (amount: number) => formatMoney(amount, currency);
  const nameFor = (id: string | null) => roster.find(row => row.user_id === id)?.name ?? 'Previously assigned staff member';
  const isHolder = receipt?.current_holder_id === actor;
  const isCashier = roster.some(row => row.user_id === actor && row.cashier);
  const isReceiver = receipt?.pending_receiver_id === actor;
  const canComplete = (order.fulfilment_mode === 'collection' && order.status === 'ready') ||
    (order.status === 'out_for_delivery' && (order.assigned_collector_id === actor || isAdmin));
  const run = async (action: StaffAction, details: StaffCommand['details'] = {}) => {
    setBusy(true); setError('');
    try { await onCommand({ orderId: order.id, expectedVersion: order.version, action, details }); setPanel(null); }
    catch (err) { setError(staffError(err)); }
    finally { setBusy(false); }
  };
  const submit = () => {
    if (!panel) return;
    try {
      const details: StaffCommand['details'] = {};
      if (reason.trim()) details.reason = reason.trim();
      if (panel === 'dispatch') details.collector_id = person;
      if (panel === 'request_cash_handover') details.receiver_id = person;
      if (panel === 'complete') Object.assign(details, { cash_received: confirmed, handover_confirmed: handedOver,
        cash_currency: currency, tendered_minor: parseCashMinor(tender), sale_reference: reference });
      if (panel === 'accept_cash_handover' || panel === 'settle_cash') Object.assign(details, { cash_counted: confirmed, till_reference: reference });
      if (panel === 'refund') Object.assign(details, { refund_confirmed: confirmed, refund_source: 'till', credit_note_reference: reference });
      void run(panel, details);
    } catch (err) { setError(staffError(err)); }
  };
  const open = (action: StaffAction) => { setPanel(action); setError(''); setConfirmed(false); setHandedOver(false); setReference(''); setPerson(''); setReason(''); setTender(''); };
  let change: number | null = null;
  try { change = parseCashMinor(tender) - (order.total_minor ?? 0); } catch { /* incomplete input */ }
  const disabled = busy || blocked;
  return <View className="bg-white rounded-2xl border border-line p-4 mb-4">
    <Text className="font-bold text-lg">#{order.id.slice(0, 8).toUpperCase()} · {order.status.replaceAll('_', ' ')}</Text>
    <Text selectable className="text-xs text-subtle">{order.id}</Text>
    <Text className="font-bold my-2">{money(order.total_minor ?? Math.round(order.total_amount * 100))} · {order.fulfilment_mode ?? 'Legacy order'}</Text>
    <Text>{snapshotText(order.contact_snapshot, 'name')} · {snapshotText(order.contact_snapshot, 'phone')}</Text>
    {order.fulfilment_mode === 'delivery' ? <>
      <Text className="mt-2">{snapshotText(order.delivery_snapshot, 'address')}</Text>
      <Text>{snapshotText(order.delivery_snapshot, 'instructions')}</Text>
      {order.assigned_collector_id ? <Text>Collector: {nameFor(order.assigned_collector_id)}</Text> : null}
    </> : null}
    <Text className="text-subtle mt-2">Placed {new Date(order.created_at).toLocaleString()}</Text>
    {order.status === 'pending' && order.acceptance_deadline ? <Text className="text-amber-800">Accept before {new Date(order.acceptance_deadline).toLocaleTimeString()}</Text> : null}
    <View className="bg-canvas p-3 rounded-lg my-3">
      {order.order_items.map(item => <View key={item.id} className="mb-2">
        <Text>{item.quantity} × {item.item_name ?? 'Meal'}</Text>
        <Text className="text-subtle">{Array.isArray(item.modifiers_snapshot) ? item.modifiers_snapshot.map(choice => snapshotText(choice, 'name')).join(', ') : ''}</Text>
        {item.line_total_minor !== null ? <Text>{money(item.line_total_minor)}</Text> : null}
      </View>)}
    </View>
    <Text>Payment: {order.payment_status ?? 'Unconfirmed'} · Loyalty: {order.loyalty_status.replaceAll('_', ' ')}</Text>
    {order.loyalty_status === 'awarded' ? <Text>{order.points_earned} points earned</Text> : null}
    {order.loyalty_status === 'awaiting_review' ? <Text className="text-amber-800">Administrator must review the customer’s opening balance, then retry earning.</Text> : null}
    {!order.quote_id ? <Text className="text-subtle mt-3">Legacy order: contact an administrator for a reviewed resolution.</Text> : <>
      {order.status === 'pending' ? <>
        <Action label="Accept order" disabled={disabled} onPress={() => { void run('accept'); }} />
        {order.acceptance_deadline && Date.parse(order.acceptance_deadline) <= Date.now() ? <Action label="Close expired request" disabled={disabled} onPress={() => { void run('expire'); }} /> : null}
      </> : null}
      {order.status === 'accepted' ? <Action label="Start preparing" disabled={disabled} onPress={() => { void run('prepare'); }} /> : null}
      {order.status === 'preparing' ? <Action label="Mark food ready" disabled={disabled} onPress={() => { void run('ready'); }} /> : null}
      {order.status === 'ready' && order.fulfilment_mode === 'delivery' ? <Action label="Assign collector and dispatch" disabled={disabled} onPress={() => open('dispatch')} /> : null}
      {canComplete && order.payment_status === 'unpaid' ? <Action label="Record cash and customer handover" disabled={disabled} onPress={() => open('complete')} /> : null}
      {!['completed', 'cancelled'].includes(order.status) && order.payment_status === 'unpaid' &&
        (order.status !== 'out_for_delivery' || order.assigned_collector_id === actor || isAdmin) ? <Action label="Cancel order…" disabled={disabled} onPress={() => open('cancel')} /> : null}
      {receipt ? <View className="border-t border-line mt-3 pt-3">
        <Text selectable>GAAP sale reference: {receipt.sale_reference}</Text>
        <Text>Tendered {money(receipt.tendered_minor)} · Change {money(receipt.change_minor)}</Text>
        <Text>Cash custody: {order.cash_custody_status?.replaceAll('_', ' ')} · {nameFor(receipt.current_holder_id)}</Text>
        {!receipt.settled_at ? <>
          <Text className="font-bold mt-2">To acknowledge at till: {money(receipt.amount_minor)}</Text>
          {order.payment_status === 'refunded' ? <Text>Refund recorded separately. The collected cash still needs a till acknowledgement.</Text> : null}
          {receipt.pending_receiver_id ? <Text>Awaiting acknowledgement by {nameFor(receipt.pending_receiver_id)}</Text> : null}
          {isHolder && !receipt.pending_receiver_id ? <Action label="Hand cash to another cashier…" disabled={disabled} onPress={() => open('request_cash_handover')} /> : null}
          {isHolder && receipt.pending_receiver_id ? <Action label="Cancel pending cash handover…" disabled={disabled} onPress={() => open('cancel_cash_handover')} /> : null}
          {isReceiver && isCashier ? <Action label="Count and acknowledge received cash…" disabled={disabled} onPress={() => open('accept_cash_handover')} /> : null}
          {isHolder && isCashier && !receipt.pending_receiver_id ? <Action label="Count my cash into till…" disabled={disabled} onPress={() => open('settle_cash')} /> : null}
        </> : null}
      </View> : null}
      {isAdmin && order.status === 'completed' && order.payment_status === 'paid' ? <Action label="Record full cash refund…" disabled={disabled} onPress={() => open('refund')} /> : null}
      {isAdmin && order.loyalty_status === 'awaiting_review' && order.payment_status === 'paid' ? <Action label="Retry earning after opening review" disabled={disabled} onPress={() => { void run('retry_loyalty'); }} /> : null}
      {panel ? <View className="bg-canvas border border-line rounded-xl p-3 mt-3">
        <Text className="font-bold text-lg mb-2">{panel.replaceAll('_', ' ')}</Text>
        {panel === 'dispatch' || panel === 'request_cash_handover' ? <>
          <Text>Select {panel === 'dispatch' ? 'collector' : 'receiving cashier'}</Text>
          {roster.filter(row => panel === 'dispatch' || (row.cashier && row.user_id !== actor)).map(row => <TouchableOpacity
            key={row.user_id} accessibilityRole="radio" accessibilityState={{ selected: person === row.user_id }} onPress={() => setPerson(row.user_id)} className="p-3 border-b border-line">
            <Text>{person === row.user_id ? '●' : '○'} {row.name}{row.cashier ? ' · cashier' : ''}</Text>
          </TouchableOpacity>)}
        </> : null}
        {panel === 'complete' ? <>
          <Text>Record the full GAAP reference including business date, till and sale number.</Text>
          <Field label="GAAP sale reference" value={reference} onChange={setReference} />
          <Field label={`Cash tendered (${currency})`} value={tender} onChange={setTender} numeric />
          {change !== null ? <Text className={change < 0 ? 'text-red-700' : 'text-slate-700'}>{change < 0 ? `Short by ${money(-change)}` : `Return change: ${money(change)}`}</Text> : null}
          <Confirm label={`I received the cash in ${currency} and returned any change`} value={confirmed} onChange={setConfirmed} />
          <Confirm label="I handed the order to the customer" value={handedOver} onChange={setHandedOver} />
        </> : null}
        {panel === 'settle_cash' || panel === 'accept_cash_handover' ? <>
          <Field label="Till acknowledgement reference (date / till / entry)" value={reference} onChange={setReference} />
          <Confirm label={`I counted ${money(receipt?.amount_minor ?? 0)} and accepted it into the till`} value={confirmed} onChange={setConfirmed} />
        </> : null}
        {panel === 'refund' ? <>
          <Text>Full refund: {money(order.total_minor ?? 0)}. Record the GAAP credit note and return the cash before confirming.</Text>
          <Field label="GAAP credit note reference (date / till / note)" value={reference} onChange={setReference} />
          <Confirm label="The full refund was paid from the GAAP till. Any unsettled collected cash still needs to reach the till." value={confirmed} onChange={setConfirmed} />
        </> : null}
        <Field label={['cancel', 'cancel_cash_handover', 'refund'].includes(panel) ||
          (panel === 'complete' && order.fulfilment_mode === 'delivery' && order.assigned_collector_id !== actor) ? 'Reason (required)' : 'Reason / note (optional)'} value={reason} onChange={setReason} />
        <Action label={busy ? 'Checking…' : 'Confirm action'} disabled={disabled} onPress={submit} />
        <TouchableOpacity onPress={() => setPanel(null)} disabled={busy} className="p-3"><Text className="text-center text-subtle">Close form</Text></TouchableOpacity>
      </View> : null}
    </>}
    <TouchableOpacity onPress={() => setShowHistory(value => !value)} className="py-3 mt-2">
      <Text className="text-subtle font-bold">{showHistory ? 'Hide' : 'Show'} order audit history</Text>
    </TouchableOpacity>
    {showHistory ? [...order.events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(event => <View key={event.id} className="py-2 border-t border-line">
      <Text>{event.event_type.replaceAll('_', ' ')} · {event.status}</Text>
      <Text className="text-xs text-subtle">{new Date(event.created_at).toLocaleString()} · {event.actor_id === order.user_id ? 'Customer' : event.actor_id ? nameFor(event.actor_id) : 'System expiry'}</Text>
      {snapshotText(event.details, 'reason') ? <Text>{snapshotText(event.details, 'reason')}</Text> : null}
    </View>) : null}
    {error ? <Text accessibilityRole="alert" className="text-red-700 mt-3">{error}</Text> : null}
  </View>;
}
export function StaffOrders(props: Props) {
  if (props.isLoading && !props.orders.length) return <ActivityIndicator color="#dc2626" className="my-8" />;
  if (!props.orders.length) return <Text className="text-subtle py-8 text-center">No orders or outstanding cash in this worklist.</Text>;
  return <View>{props.orders.map(order => <OrderCard key={`${props.actor}:${order.id}:${order.version}`} order={order} {...props} />)}</View>;
}
