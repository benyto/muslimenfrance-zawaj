// The conversation list itself lives in MessagingWorkspaceLayout — on
// mobile it renders full-width in place of this route's Outlet slot, on
// desktop it's the persistent left sidebar. This route only ever needs to
// show the desktop "nothing selected yet" placeholder.
export default function Messages() {
  return (
    <div className="hidden min-h-[50vh] items-center justify-center lg:flex">
      <p className="text-sm text-muted">
        Sélectionnez une conversation pour commencer à discuter.
      </p>
    </div>
  );
}
