import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useDeleteGame, type CashGame } from '@/services/games';
import { useGroup } from '@/services/groups';

import { Button } from './Button';

type Props = {
  game: Pick<CashGame, 'id' | 'groupId' | 'isHost' | 'status' | 'settlements'>;
  /** "cash" ou "torneio", para a mensagem */
  label?: string;
};

/**
 * Excluir o jogo (cash ou torneio), durante ou depois. Só aparece para o host do jogo ou o admin do grupo.
 * Apaga tudo do jogo, com confirmação; a lista de jogadores do grupo não muda.
 */
export function DeleteGameButton({ game, label = 'cash' }: Props) {
  const group = useGroup(game.groupId);
  const deleteGame = useDeleteGame(game);
  const canDelete = game.isHost || group.data?.role === 'admin';
  if (!canDelete) return null;

  const paidCount = game.settlements.filter((s) => s.paidAt || s.receivedAt).length;
  const warning =
    game.status === 'finished'
      ? paidCount > 0
        ? `O acerto deste ${label} já tem pagamentos marcados. Excluindo, some tudo: resultado, Pix e quem pagou.`
        : `Some tudo deste ${label}: buy-ins, contagem, resultado e acerto.`
      : `O ${label} está em andamento. Excluindo, some tudo o que foi lançado até agora.`;

  function confirm() {
    Alert.alert(`Excluir este ${label}?`, `${warning} Não dá para desfazer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          deleteGame.mutate(undefined, {
            onSuccess: () => router.replace({ pathname: '/groups/[groupId]', params: { groupId: game.groupId } }),
            onError: (e) => Alert.alert('Não deu para excluir', e.message),
          }),
      },
    ]);
  }

  return (
    <Button title={`Excluir ${label}`} variant="danger" onPress={confirm} loading={deleteGame.isPending} />
  );
}
