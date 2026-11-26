import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  FormMessage,
  LoadingState,
  MoneyField,
  NumberField,
  Screen,
  SegmentedControl,
  TextField,
} from '@/components';
import { formatChipValue } from '@/lib/kit';
import { formatBRL, type Cents } from '@/lib/money';
import { checkPrizePercents, defaultPrizePercents, prizeAmounts } from '@/lib/prizes';
import {
  checkStructure,
  generateStructure,
  levelNumbers,
  placeBreaks,
  stacksAvailable,
  stackTotal,
  structureMinutes,
  type KitChip,
  type StructureLevel,
} from '@/lib/structure';
import {
  checkKit,
  checkSettings,
  DEFAULT_BREAKS,
  draftFromGenerated,
  estimatedPool,
  markAddonBreak,
  type BreakSettings,
  type SetupInput,
  type TournamentDraft,
  type TournamentSettings,
} from '@/lib/tournament';
import { useGroup } from '@/services/groups';
import { useGroupKit } from '@/services/kits';
import { usePlayers } from '@/services/players';
import { useDeleteStructure, useGroupStructures, useSaveStructure, type SavedStructure } from '@/services/structures';
import { colors, radius, spacing } from '@/theme';

/** Opções de "intervalo a cada" (minutos de jogo; 'none' = sem intervalo). */
type BreakEvery = 'none' | '60' | '90' | '120' | '180';
const BREAK_OPTIONS: { value: BreakEvery; label: string }[] = [
  { value: 'none', label: 'Sem' },
  { value: '60', label: '1h' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2h' },
  { value: '180', label: '3h' },
];
const toBreakEvery = (minutes: number | null): BreakEvery =>
  minutes === null ? 'none' : (BREAK_OPTIONS.find((o) => o.value === String(minutes))?.value ?? '60');
const fromBreakEvery = (value: BreakEvery): number | null => (value === 'none' ? null : Number(value));

type Editing = { draft: TournamentDraft; warnings: string[]; savedId: string | null; name: string };

/**
 * Torneio, parte 5a: o host diz quantos jogadores, buy-in, rebuy, add-on e duração; o app gera a estrutura
 * (stack, níveis, intervalos, color up, premiação e relógio da jogada). Tudo editável e pode ser salvo no grupo.
 */
export default function TournamentScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const kit = useGroupKit(groupId, 'tournament', group.data?.tournamentKitId);
  const players = usePlayers(groupId);
  const structures = useGroupStructures(groupId);
  const [editing, setEditing] = useState<Editing | null>(null);

  if (!group.data || kit.data === undefined || !players.data) {
    return (
      <Screen>
        <LoadingState error={group.error ?? kit.error ?? players.error} onRetry={() => group.refetch()} />
      </Screen>
    );
  }

  if (!kit.data) {
    const isAdmin = group.data.role === 'admin';
    return (
      <Screen>
        <EmptyState
          title="Falta o kit do torneio"
          message={
            isAdmin
              ? 'Cadastre as fichas do torneio (cor, valor em pontos e quantidade) para o app montar a estrutura.'
              : 'Peça para o admin do grupo cadastrar o kit do torneio.'
          }
          action={
            isAdmin ? (
              <Button
                title="Cadastrar kit do torneio"
                onPress={() =>
                  router.replace({ pathname: '/groups/[groupId]/kit', params: { groupId, kind: 'tournament' } })
                }
              />
            ) : undefined
          }
        />
      </Screen>
    );
  }

  const kitChips: KitChip[] = kit.data.denominations.map((d) => ({
    color: d.color,
    value: d.value,
    quantity: d.quantity,
  }));

  if (editing) {
    return <DraftEditor groupId={groupId} kit={kitChips} initial={editing} onBack={() => setEditing(null)} />;
  }

  return (
    <SetupForm
      kit={kitChips}
      activePlayers={players.data.filter((p) => p.active).length}
      saved={structures.data ?? []}
      groupId={groupId}
      onReady={setEditing}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Passo 1: o que o host sabe antes do torneio

function SetupForm({
  kit,
  activePlayers,
  saved,
  groupId,
  onReady,
}: {
  kit: KitChip[];
  activePlayers: number;
  saved: SavedStructure[];
  groupId: string;
  onReady: (editing: Editing) => void;
}) {
  const deleteStructure = useDeleteStructure(groupId);
  const [players, setPlayers] = useState<number | null>(Math.max(2, activePlayers));
  const [buyin, setBuyin] = useState<Cents | null>(5000);
  const [rebuy, setRebuy] = useState<'yes' | 'no'>('yes');
  const [maxRebuys, setMaxRebuys] = useState<number | null>(null);
  const [addon, setAddon] = useState<'yes' | 'no'>('yes');
  const [addonValue, setAddonValue] = useState<Cents | null>(5000);
  const [levelMinutes, setLevelMinutes] = useState<number | null>(20);
  const [hours, setHours] = useState<number | null>(4);
  const [breakEvery, setBreakEvery] = useState<BreakEvery>('60');
  const [breakMinutes, setBreakMinutes] = useState<number | null>(DEFAULT_BREAKS.minutes);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    if (!players || players < 2) return setError('O torneio precisa de pelo menos 2 jogadores.');
    if (!buyin || buyin <= 0) return setError('Digite o valor do buy-in, como 50.');
    if (!levelMinutes || levelMinutes < 5 || levelMinutes > 60) return setError('Cada nível dura de 5 a 60 minutos.');
    if (!hours || hours < 1 || hours > 12) return setError('A duração é de 1 a 12 horas.');
    if (addon === 'yes' && (!addonValue || addonValue <= 0)) return setError('Digite o valor do add-on.');
    if (breakEvery !== 'none' && (!breakMinutes || breakMinutes < 1 || breakMinutes > 120))
      return setError('Cada intervalo dura de 1 a 120 minutos.');
    setError(null);
    const breaks: BreakSettings = { everyMinutes: fromBreakEvery(breakEvery), minutes: breakMinutes ?? DEFAULT_BREAKS.minutes };

    const input: SetupInput = {
      players,
      buyinCents: buyin,
      rebuy: { enabled: rebuy === 'yes', maxPerPlayer: rebuy === 'yes' ? maxRebuys : null },
      addon: { enabled: addon === 'yes', cents: addon === 'yes' ? (addonValue ?? 0) : 0 },
      levelMinutes,
      targetMinutes: hours * 60,
      breaks,
    };
    const generated = generateStructure({
      players,
      kit,
      levelMinutes,
      targetMinutes: hours * 60,
      breakEveryMinutes: breaks.everyMinutes,
      breakMinutes: breaks.minutes,
      rebuy: input.rebuy,
      addon: { enabled: input.addon.enabled },
    });
    if (generated.levels.length === 0) return setError(generated.warnings.join(' '));
    onReady({ draft: draftFromGenerated(input, generated), warnings: generated.warnings, savedId: null, name: '' });
  }

  function confirmDelete(structure: SavedStructure) {
    Alert.alert('Apagar estrutura?', `"${structure.name}" sai da lista de estruturas do grupo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => deleteStructure.mutate(structure.id, { onError: (e) => setError(e.message) }),
      },
    ]);
  }

  return (
    <Screen footer={<Button title="Gerar estrutura" onPress={generate} />}>
      {saved.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading">Estruturas do grupo</AppText>
          {saved.map((structure) => (
            <Card
              key={structure.id}
              accessibilityLabel={`Abrir estrutura ${structure.name}`}
              onPress={() => onReady({ draft: structure, warnings: [], savedId: structure.id, name: structure.name })}
            >
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="label">{structure.name}</AppText>
                  <AppText variant="caption">
                    {structure.settings.players} jogadores · buy-in {formatBRL(structure.settings.buyinCents)} · stack{' '}
                    {formatChipValue(structure.settings.startingStack)}
                  </AppText>
                </View>
                <Button title="Apagar" variant="ghost" compact onPress={() => confirmDelete(structure)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="heading">Novo torneio</AppText>
        <AppText variant="caption">
          O app monta a estrutura com o kit do torneio do grupo. Depois você ajusta tudo.
        </AppText>
        <NumberField label="Quantos jogadores" value={players} onChange={setPlayers} />
        <MoneyField label="Buy-in (R$)" value={buyin} onChange={setBuyin} hint="O rebuy tem o mesmo valor." />

        <AppText variant="label">Rebuy</AppText>
        <SegmentedControl
          accessibilityLabel="Tem rebuy"
          options={[
            { value: 'yes', label: 'Com rebuy' },
            { value: 'no', label: 'Sem rebuy' },
          ]}
          value={rebuy}
          onChange={setRebuy}
        />
        {rebuy === 'yes' ? (
          <NumberField
            label="Máximo de rebuys por pessoa"
            value={maxRebuys}
            onChange={setMaxRebuys}
            placeholder="Sem limite"
            hint="Deixe vazio para não ter limite."
          />
        ) : null}

        <AppText variant="label">Add-on</AppText>
        <SegmentedControl
          accessibilityLabel="Tem add-on"
          options={[
            { value: 'yes', label: 'Com add-on' },
            { value: 'no', label: 'Sem add-on' },
          ]}
          value={addon}
          onChange={setAddon}
        />
        {addon === 'yes' ? (
          <MoneyField label="Valor do add-on (R$)" value={addonValue} onChange={setAddonValue} />
        ) : null}

        <NumberField label="Minutos de cada nível" value={levelMinutes} onChange={setLevelMinutes} />
        <NumberField label="Duração do torneio (horas)" value={hours} onChange={setHours} />

        <AppText variant="label">Intervalo a cada</AppText>
        <SegmentedControl
          accessibilityLabel="Intervalo a cada quantas horas"
          options={BREAK_OPTIONS}
          value={breakEvery}
          onChange={setBreakEvery}
        />
        {breakEvery !== 'none' ? (
          <NumberField label="Minutos de cada intervalo" value={breakMinutes} onChange={setBreakMinutes} />
        ) : null}
      </View>
      <FormMessage message={error} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------------------------
// Passo 2: estrutura gerada, tudo editável

function DraftEditor({
  groupId,
  kit,
  initial,
  onBack,
}: {
  groupId: string;
  kit: KitChip[];
  initial: Editing;
  onBack: () => void;
}) {
  const save = useSaveStructure(groupId);
  const [draft, setDraft] = useState(initial.draft);
  const [savedId, setSavedId] = useState(initial.savedId);
  const [name, setName] = useState(initial.name);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  const { settings, levels } = draft;
  const numbers = levelNumbers(levels);
  const levelCount = numbers.filter((n) => n !== null).length;

  function setSettings(changes: Partial<TournamentSettings>) {
    setDraft((current) => {
      const next = { ...current.settings, ...changes };
      return {
        settings: next,
        levels: markAddonBreak(current.levels, next.rebuy.untilLevel, next.addon.enabled, { insert: true }),
      };
    });
  }

  function setLevels(update: (levels: StructureLevel[]) => StructureLevel[]) {
    setDraft((current) => ({
      ...current,
      levels: markAddonBreak(
        update(current.levels),
        current.settings.rebuy.untilLevel,
        current.settings.addon.enabled,
        {
          insert: true,
        },
      ),
    }));
  }

  const breaks = settings.breaks ?? DEFAULT_BREAKS;

  /** Muda "intervalo a cada" ou a duração: refaz todos os intervalos da lista de níveis. */
  function setBreaks(next: BreakSettings) {
    setDraft((current) => {
      const nextSettings = { ...current.settings, breaks: next };
      if (next.minutes < 1 || next.minutes > 120) return { ...current, settings: nextSettings };
      return {
        settings: nextSettings,
        levels: markAddonBreak(
          placeBreaks(current.levels, next.everyMinutes, next.minutes),
          nextSettings.rebuy.untilLevel,
          nextSettings.addon.enabled,
          { insert: true },
        ),
      };
    });
    setOpenRow(null);
  }

  function setStackCount(index: number, count: number | null) {
    const stack = settings.stack.map((chip, i) => (i === index ? { ...chip, count: count ?? 0 } : chip));
    const total = stackTotal(stack);
    setSettings({ stack, startingStack: total, addon: { ...settings.addon, chips: total } });
  }

  function addLevel() {
    setLevels((current) => {
      const last = [...current].reverse().find((l) => l.kind === 'level');
      const bigBlind = last && last.kind === 'level' ? last.bigBlind * 2 : 100;
      return [
        ...current,
        { kind: 'level', smallBlind: bigBlind / 2, bigBlind, ante: 0, minutes: settings.levelMinutes },
      ];
    });
    setOpenRow(levels.length);
  }

  function addBreak() {
    setLevels((current) => [...current, { kind: 'break', minutes: 10, colorUp: null, addon: false }]);
    setOpenRow(levels.length);
  }

  const kitCheck = checkKit(kit, settings);

  function saveStructure() {
    const problems = [...checkStructure(levels), ...checkSettings(settings, levelCount)];
    if (kitCheck.blocking) problems.push(kitCheck.blocking);
    const prizeProblem = checkPrizePercents(settings.prizePercents);
    if (prizeProblem) problems.push(prizeProblem);
    if (!name.trim()) problems.push('Dê um nome para a estrutura, como "Torneio de sexta".');
    if (problems.length) return setMessage({ text: problems.join('\n'), tone: 'error' });
    setMessage(null);
    if (kitCheck.warning) {
      Alert.alert('Pode faltar ficha', `${kitCheck.warning}\n\nSalvar mesmo assim?`, [
        { text: 'Voltar e ajustar', style: 'cancel' },
        { text: 'Salvar', onPress: doSave },
      ]);
      return;
    }
    doSave();
  }

  function doSave() {
    save.mutate(
      { id: savedId, name, draft },
      {
        onSuccess: (id) => {
          setSavedId(id);
          setMessage({ text: 'Estrutura salva no grupo.', tone: 'success' });
        },
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  const pool = estimatedPool(settings);
  const stacksInKit = stacksAvailable(kit, settings.stack);

  return (
    <Screen
      footer={
        <>
          <Button
            title={savedId ? 'Salvar alterações' : 'Salvar estrutura do grupo'}
            onPress={saveStructure}
            loading={save.isPending}
          />
          <Button title="Voltar e gerar de novo" variant="ghost" onPress={onBack} />
        </>
      }
    >
      {kitCheck.blocking || kitCheck.warning ? (
        <Card style={kitCheck.blocking ? styles.blockingCard : styles.warningCard}>
          <AppText variant="label" style={kitCheck.blocking ? styles.blocking : styles.warning}>
            {kitCheck.blocking ?? kitCheck.warning}
          </AppText>
        </Card>
      ) : null}
      {initial.warnings
        .filter((w) => w.includes('stack ficou pequeno'))
        .map((w) => (
          <Card key={w} style={styles.warningCard}>
            <AppText variant="label" style={styles.warning}>
              {w}
            </AppText>
          </Card>
        ))}

      {/* Stack inicial */}
      <Card>
        <AppText variant="heading">Stack inicial</AppText>
        <AppText variant="number" style={styles.gold}>
          {formatChipValue(settings.startingStack)}
        </AppText>
        {settings.stack.map((chip, i) => (
          <NumberField
            key={`${chip.color}-${chip.value}`}
            label={`${chip.color} (${formatChipValue(chip.value)})`}
            value={chip.count}
            onChange={(count) => setStackCount(i, count)}
          />
        ))}
        <AppText variant="caption">
          O kit monta {stacksInKit} stacks assim (contando rebuys e add-ons de quem pedir).
        </AppText>
      </Card>

      {/* Entradas */}
      <Card>
        <AppText variant="heading">Entradas</AppText>
        <NumberField
          label="Jogadores previstos"
          value={settings.players}
          onChange={(players) => setSettings({ players: players ?? 0 })}
        />
        <MoneyField
          label="Buy-in e rebuy (R$)"
          value={settings.buyinCents}
          onChange={(buyinCents) => setSettings({ buyinCents: buyinCents ?? 0 })}
        />
        <SegmentedControl
          accessibilityLabel="Tem rebuy"
          options={[
            { value: 'yes', label: 'Com rebuy' },
            { value: 'no', label: 'Sem rebuy' },
          ]}
          value={settings.rebuy.enabled ? 'yes' : 'no'}
          onChange={(v) => setSettings({ rebuy: { ...settings.rebuy, enabled: v === 'yes' } })}
        />
        {settings.rebuy.enabled ? (
          <NumberField
            label="Máximo de rebuys por pessoa"
            value={settings.rebuy.maxPerPlayer}
            placeholder="Sem limite"
            onChange={(maxPerPlayer) => setSettings({ rebuy: { ...settings.rebuy, maxPerPlayer } })}
          />
        ) : null}
        {settings.rebuy.enabled || settings.addon.enabled ? (
          <NumberField
            label="Rebuy e atrasados até o nível"
            value={settings.rebuy.untilLevel}
            hint="Depois desse nível (e do intervalo do add-on) não entra mais ninguém."
            onChange={(untilLevel) => setSettings({ rebuy: { ...settings.rebuy, untilLevel } })}
          />
        ) : null}
        <SegmentedControl
          accessibilityLabel="Tem add-on"
          options={[
            { value: 'yes', label: 'Com add-on' },
            { value: 'no', label: 'Sem add-on' },
          ]}
          value={settings.addon.enabled ? 'yes' : 'no'}
          onChange={(v) => setSettings({ addon: { ...settings.addon, enabled: v === 'yes' } })}
        />
        {settings.addon.enabled ? (
          <>
            <MoneyField
              label="Valor do add-on (R$)"
              value={settings.addon.cents}
              onChange={(cents) => setSettings({ addon: { ...settings.addon, cents: cents ?? 0 } })}
            />
            <NumberField
              key={`addon-chips-${settings.startingStack}`}
              label="Fichas do add-on"
              value={settings.addon.chips}
              onChange={(chips) => setSettings({ addon: { ...settings.addon, chips: chips ?? 0 } })}
            />
          </>
        ) : null}
      </Card>

      {/* Intervalos */}
      <Card>
        <AppText variant="heading">Intervalos</AppText>
        <AppText variant="label">Intervalo a cada</AppText>
        <SegmentedControl
          accessibilityLabel="Intervalo a cada quantas horas"
          options={BREAK_OPTIONS}
          value={toBreakEvery(breaks.everyMinutes)}
          onChange={(v) => setBreaks({ ...breaks, everyMinutes: fromBreakEvery(v) })}
        />
        {breaks.everyMinutes !== null ? (
          <NumberField
            label="Minutos de cada intervalo"
            value={breaks.minutes}
            onChange={(minutes) => setBreaks({ ...breaks, minutes: minutes ?? 0 })}
          />
        ) : null}
        <AppText variant="caption">
          Mudar aqui refaz os intervalos da lista de níveis (as trocas de fichas vão junto). O intervalo do add-on
          continua logo depois do período de rebuy.
        </AppText>
      </Card>

      {/* Níveis */}
      <View style={styles.section}>
        <AppText variant="heading">Níveis</AppText>
        <AppText variant="caption">
          {levelCount} níveis · {Math.round(structureMinutes(levels) / 6) / 10} horas no total. Toque para editar.
        </AppText>
        {levels.map((level, i) => (
          <LevelRow
            key={i}
            level={level}
            number={numbers[i]}
            open={openRow === i}
            onToggle={() => setOpenRow(openRow === i ? null : i)}
            onChange={(next) => setLevels((current) => current.map((l, j) => (j === i ? next : l)))}
            onRemove={() => {
              setLevels((current) => current.filter((_, j) => j !== i));
              setOpenRow(null);
            }}
          />
        ))}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="+ Nível" variant="secondary" onPress={addLevel} />
          </View>
          <View style={styles.flex}>
            <Button title="+ Intervalo" variant="secondary" onPress={addBreak} />
          </View>
        </View>
      </View>

      {/* Premiação */}
      <PrizeEditor
        percents={settings.prizePercents}
        pool={pool}
        onChange={(prizePercents) => setSettings({ prizePercents })}
      />

      {/* Relógio da jogada */}
      <Card>
        <AppText variant="heading">Relógio da jogada</AppText>
        <SegmentedControl
          accessibilityLabel="Relógio da jogada"
          options={[
            { value: 'yes', label: 'Ligado' },
            { value: 'no', label: 'Desligado' },
          ]}
          value={settings.shotClock.enabled ? 'yes' : 'no'}
          onChange={(v) => setSettings({ shotClock: { ...settings.shotClock, enabled: v === 'yes' } })}
        />
        {settings.shotClock.enabled ? (
          <>
            <NumberField
              label="Segundos antes do flop"
              value={settings.shotClock.preflopSeconds}
              onChange={(n) => setSettings({ shotClock: { ...settings.shotClock, preflopSeconds: n ?? 0 } })}
            />
            <NumberField
              label="Segundos depois do flop"
              value={settings.shotClock.postflopSeconds}
              onChange={(n) => setSettings({ shotClock: { ...settings.shotClock, postflopSeconds: n ?? 0 } })}
            />
            <NumberField
              label="Time banks por jogador"
              value={settings.shotClock.timeBanks}
              onChange={(n) => setSettings({ shotClock: { ...settings.shotClock, timeBanks: n ?? 0 } })}
            />
            <NumberField
              label="Segundos de cada time bank"
              value={settings.shotClock.timeBankSeconds}
              onChange={(n) => setSettings({ shotClock: { ...settings.shotClock, timeBankSeconds: n ?? 0 } })}
            />
            <NumberField
              label="Ligar a partir do nível"
              value={settings.shotClock.fromLevel}
              onChange={(n) => setSettings({ shotClock: { ...settings.shotClock, fromLevel: n ?? 0 } })}
            />
          </>
        ) : null}
      </Card>

      <TextField
        label="Nome da estrutura"
        value={name}
        onChangeText={setName}
        placeholder="Torneio de sexta"
        maxLength={60}
      />
      <FormMessage message={message?.text} tone={message?.tone} />
    </Screen>
  );
}

function LevelRow({
  level,
  number,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  level: StructureLevel;
  number: number | null;
  open: boolean;
  onToggle: () => void;
  onChange: (level: StructureLevel) => void;
  onRemove: () => void;
}) {
  const title =
    level.kind === 'level'
      ? `Nível ${number} · ${formatChipValue(level.smallBlind)} / ${formatChipValue(level.bigBlind)}${
          level.ante ? ` · ante ${formatChipValue(level.ante)}` : ''
        }`
      : level.addon
        ? 'Intervalo · add-on'
        : 'Intervalo';

  return (
    <View style={[styles.levelRow, level.kind === 'break' && styles.breakRow]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${title}`}
        onPress={onToggle}
        style={styles.levelHeader}
      >
        <View style={styles.flex}>
          <AppText variant={level.kind === 'level' ? 'number' : 'label'}>{title}</AppText>
          {level.kind === 'break' && level.colorUp ? <AppText variant="caption">{level.colorUp}</AppText> : null}
        </View>
        <AppText variant="caption">{level.minutes} min</AppText>
      </Pressable>
      {open ? (
        <View style={styles.levelEditor}>
          {level.kind === 'level' ? (
            <>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <NumberField
                    label="Small blind"
                    value={level.smallBlind}
                    onChange={(n) => onChange({ ...level, smallBlind: n ?? 0 })}
                  />
                </View>
                <View style={styles.flex}>
                  <NumberField
                    label="Big blind"
                    value={level.bigBlind}
                    onChange={(n) => onChange({ ...level, bigBlind: n ?? 0 })}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <NumberField label="Ante" value={level.ante} onChange={(n) => onChange({ ...level, ante: n ?? 0 })} />
                </View>
                <View style={styles.flex}>
                  <NumberField
                    label="Minutos"
                    value={level.minutes}
                    onChange={(n) => onChange({ ...level, minutes: n ?? 0 })}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <NumberField
                label="Minutos"
                value={level.minutes}
                onChange={(n) => onChange({ ...level, minutes: n ?? 0 })}
              />
              <TextField
                label="Troca de fichas (opcional)"
                value={level.colorUp ?? ''}
                onChangeText={(text) => onChange({ ...level, colorUp: text.trim() ? text : null })}
                placeholder="Trocar as fichas Branca (25) por Vermelha (100)"
                maxLength={100}
              />
            </>
          )}
          <Button title="Remover" variant="danger" compact onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

function PrizeEditor({
  percents,
  pool,
  onChange,
}: {
  percents: number[];
  pool: Cents;
  onChange: (p: number[]) => void;
}) {
  const problem = checkPrizePercents(percents);
  const amounts = problem ? null : prizeAmounts(pool, percents);
  const setPlaces = (places: number) => onChange(defaultPrizePercents(Math.max(1, places)));

  return (
    <Card>
      <AppText variant="heading">Premiação</AppText>
      <AppText variant="caption">
        Valores com {formatBRL(pool)} (só os buy-ins). No torneio, rebuys e add-ons aumentam o prêmio. Dá para mudar a
        premiação a qualquer momento, inclusive num acordo na mesa final.
      </AppText>
      <View style={styles.row}>
        <Button title="−" variant="secondary" compact onPress={() => setPlaces(percents.length - 1)} />
        <AppText variant="label" style={styles.flexCenter}>
          {percents.length} {percents.length === 1 ? 'premiado' : 'premiados'}
        </AppText>
        <Button title="+" variant="secondary" compact onPress={() => setPlaces(percents.length + 1)} />
      </View>
      {percents.map((percent, i) => (
        <View key={`${percents.length}-${i}`} style={styles.row}>
          <View style={styles.flex}>
            <NumberField
              label={`${i + 1}º lugar (%)`}
              value={percent}
              onChange={(n) => onChange(percents.map((p, j) => (j === i ? (n ?? 0) : p)))}
            />
          </View>
          <AppText variant="number" style={[styles.gold, styles.prizeValue]}>
            {amounts ? formatBRL(amounts[i]) : '—'}
          </AppText>
        </View>
      ))}
      {problem ? (
        <AppText variant="caption" style={styles.warning}>
          {problem}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  flexCenter: { flex: 1, textAlign: 'center' },
  gold: { color: colors.gold },
  warning: { color: colors.warning },
  warningCard: { borderColor: colors.warning },
  blocking: { color: colors.danger },
  blockingCard: { borderColor: colors.danger },
  prizeValue: { minWidth: 110, textAlign: 'right', paddingTop: spacing.lg },
  levelRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakRow: { backgroundColor: colors.primarySoft },
  levelHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  levelEditor: { gap: spacing.sm, padding: spacing.lg, paddingTop: 0 },
});
