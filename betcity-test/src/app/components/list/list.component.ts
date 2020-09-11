import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {debounceTime, map, takeUntil} from "rxjs/operators";
import {BehaviorSubject, combineLatest, Observable, of, Subject} from "rxjs";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {isNullOrUndefined} from "util";
import {ListInterface, ListService} from "../../list.service";
import {PerfectScrollbarDirective} from "ngx-perfect-scrollbar";

const LOCAL_STORAGE_KEY = 'betCityList';

@Component({
	selector: 'app-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListComponent implements OnInit, OnDestroy {

	public resultsItem$: BehaviorSubject<ListItemInterface[]> = new BehaviorSubject<ListItemInterface[]>([]);
	public favouriteItems$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
	public list$: Observable<ListItemInterface[]>;
	public formGroup: FormGroup;
	public isBusy$ = new Subject<boolean>();
	@ViewChild('perfectScroll', {static: false})
	private _perfectScrollbar: PerfectScrollbarDirective;
	private _destroy$ = new Subject();
	private _nextPageToken = null;
	private _totalResults = 0;

	constructor(private _listService: ListService,
				private _fb: FormBuilder) {

		this.formGroup = this._fb.group({
			filterTitle: new FormControl(null),
			pagingSize: new FormControl(20),
			onlyFavourites: new FormControl(false)
		});

		if (!isNullOrUndefined(localStorage.getItem(LOCAL_STORAGE_KEY))) {
			const localStorageValue = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
			this.favouriteItems$.next(localStorageValue.list);
		}

		this.formGroup.get('onlyFavourites').valueChanges
			.pipe(
				takeUntil(this._destroy$)
			).subscribe(value => {
			if (value) {
				this.list$ = this.resultsItem$
					.pipe(
						map(i => {
							return i.filter(j => this.favouriteItems$.value.includes(j.id))
						})
					);
			} else {
				this.list$ = this.resultsItem$;
			}
		});

		this.formGroup.get('pagingSize').valueChanges
			.pipe(
				takeUntil(this._destroy$)
			).subscribe(value => {
			this.getList(value, null);
		});

		this.formGroup.get('filterTitle').valueChanges
			.pipe(
				takeUntil(this._destroy$),
				debounceTime(500)
			)
			.subscribe(query => {
				console.log(query, this.resultsItem$.value);
				if (!isNullOrUndefined(query)) {
					 return this.resultsItem$.pipe(
						map(items => items.filter(i => i.title.toLowerCase().indexOf(query.toLowerCase()) >= 0))
					);
				}
			});

		// this.list$ = combineLatest([this.formGroup.valueChanges, this.resultsItem$])
		// 	.pipe(map(([formGroupChanges, items]) => {
		// 			console.log(formGroupChanges);
		// 			return items.filter(item => item.title.toLowerCase().indexOf(formGroupChanges.filterTitle.toLowerCase()) >= 0);
		// 		})
		// 	);
	}

	ngOnInit() {
		this.list$ = this.resultsItem$;
		this.getList(this.formGroup.controls['pagingSize'].value, null);
	}

	public trackByFn(item: ListItemInterface): string {
		return item.id;
	}

	public onScroll() {
		if ((this._totalResults > this.resultsItem$.value.length)
			&& isNullOrUndefined(this.formGroup.get('filterTitle').value)) {
			this.getList(this.formGroup.controls['pagingSize'].value, this._nextPageToken);
		}
	}

	public isNoMoreData(): boolean {
		return this._totalResults === this.resultsItem$.value.length;
	}

	public toggleFavourite(itemList: ListItemInterface) {
		let favouriteList = this.favouriteItems$.value;
		if (this.isFavouriteItem(itemList.id)) {
			itemList.isFavourite = false;
			favouriteList = favouriteList.filter(i => i !== itemList.id);
		} else {
			itemList.isFavourite = true;
			favouriteList.push(itemList.id);
		}

		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({list: favouriteList}));
		this.favouriteItems$.next(favouriteList);
	}

	ngOnDestroy(): void {
		this._destroy$.next();
	}

	private getList(limit: string, nextPageToken: string) {
		this.isBusy$.next(true);
		this._listService.getList(limit, nextPageToken).subscribe((response: ListInterface) => {
			this.isBusy$.next(false);
			this._nextPageToken = response.nextPageToken;
			this._totalResults = response.pageInfo.totalResults;
			let resultModels = response.items.map(i => responseToModel(i, this.isFavouriteItem(i.id)));
			if (nextPageToken) {
				resultModels = this.resultsItem$.value.concat(resultModels);
			}
			this.resultsItem$.next(resultModels);
			// if (!nextPageToken) {
			// 	this._perfectScrollbar.update();
			// }
		});
	}

	private isFavouriteItem(itemId: string): boolean {
		return this.favouriteItems$.value.includes(itemId);
	}
}

function responseToModel(response: any, isFavourite?: boolean) {
	return <ListItemInterface>{
		id: response.id,
		title: response.snippet.title,
		chanelTitle: response.snippet.chanelTitle,
		description: response.snippet.description,
		playListId: response.snippet.playListId,
		isFavourite: isFavourite ? isFavourite : false
	}
}

export interface ListItemInterface {
	id: string,
	chanelTitle: string;
	description: string;
	playListId: string;
	publisheAt: Date;
	title: string;
	isFavourite: boolean;
}
