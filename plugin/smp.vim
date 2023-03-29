if exists('g:loaded_simple_markdown_preview')
    finish
endif
let g:loaded_simple_markdown_preview = 1

" Exposes the plugin's functions for use as commands in Neovim.
command! -nargs=0 SmpStart lua require("smp").start()
command! -nargs=0 SmpPreview lua require("smp").preview()
command! -nargs=0 SmpStop lua require("smp").stop()
command! -nargs=0 SmpWikiVisual lua require("smp").wrapwiki_visual()
command! -nargs=0 SmpWikiWord lua require("smp").wrapwiki_word()
command! -nargs=0 SmpWikiLine lua require("smp").wrapwiki_line()
command! -nargs=0 SmpPasteUrl lua require("smp").paste_url()
command! -nargs=0 SmpPasteWikiWord lua require("smp").paste_wiki_word()
command! -nargs=0 SmpBook lua require("smp").book()
command! -nargs=0 SmpThis lua require("smp").bookthis()
command! -nargs=0 SmpSearchTag lua require("smp").search_tag()
command! -nargs=0 SmpSearchText lua require("smp").search_text()
command! -nargs=0 SmpSyncTodo lua require("smp").synctodo()
command! -nargs=0 SmpExpandSnippet lua require("smp").expand_snippet()
command! -nargs=0 SmpExpandAllSnippets lua require("smp").expand_all_snippets()
command! -nargs=1 SmpIndicator lua require("smp").indicator(<q-args>)
command! -nargs=? SmpBreakLineIfLong lua require("smp").breakIfLong(<q-args>)
