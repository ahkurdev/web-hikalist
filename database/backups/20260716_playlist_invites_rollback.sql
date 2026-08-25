revoke execute on function public.create_hika_playlist_invite(text, integer) from authenticated;
revoke execute on function public.revoke_hika_playlist_invites(text) from authenticated;
revoke execute on function public.accept_hika_playlist_invite(text) from authenticated;

drop function if exists public.accept_hika_playlist_invite(text);
drop function if exists public.revoke_hika_playlist_invites(text);
drop function if exists public.create_hika_playlist_invite(text, integer);
drop table if exists public.hika_playlist_invites;
